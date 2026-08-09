/**
 * DCC session manager: the state machine between IRC CTCP and the platform
 * socket transport.
 *
 * Nothing here trusts the peer. Offers are parsed and bounded by
 * `protocol.ts`, every incoming offer needs explicit user consent, and the
 * transport is told which peer address it may accept a connection from.
 */
import { v4 as uuidv4 } from 'uuid';
import i18next from '@/app/i18n';
import { MessageColor } from '@/config/theme';
import { STATUS_CHANNEL } from '@/config/config';
import { ChannelCategory, MessageCategory } from '@shared/types';
import {
  setAddChannel,
  setAddMessage,
  existChannel,
} from '@features/channels/store/channels';
import { getCurrentNick } from '@features/settings/store/settings';
import { getUser } from '@features/users/store/users';
import { ircSendRawMessage } from '@/network/irc/network';
import {
  DccKind,
  dedupeFilename,
  formatDccCtcp,
  isIpLiteral,
  parseDccCtcp,
  type DccOffer,
  type DccRejectReason,
} from './protocol';
import {
  getDccSession,
  getDccSessionByChannel,
  getDccSettings,
  useDccSessionsStore,
} from './store/dcc';
import { getDccTransport, isDccAvailable } from './transport';
import {
  DccDirection,
  DccStatus,
  type DccSession,
  type DccTransportEvent,
} from './types';

/** A pending offer the user never answered is dropped after this long. */
const PENDING_TIMEOUT_MS = 120_000;

/** At most this many offers from one nick inside the window below. */
const OFFER_LIMIT = 5;
const OFFER_WINDOW_MS = 60_000;

const offerTimestamps = new Map<string, number[]>();
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

const { addDccSession, updateDccSession } = useDccSessionsStore.getState();

/** `=nick` is the long-standing convention for a DCC chat window. */
export const dccChatChannelName = (nick: string): string => `=${nick}`;

export const isDccChatChannel = (channelName: string): boolean => channelName.startsWith('=');

const statusMessage = (message: string, color: MessageColor = MessageColor.info): void => {
  setAddMessage({
    id: uuidv4(),
    message,
    target: STATUS_CHANNEL,
    time: new Date().toISOString(),
    category: MessageCategory.info,
    color,
  });
};

const sessionMessage = (session: DccSession, message: string, color: MessageColor = MessageColor.info): void => {
  setAddMessage({
    id: uuidv4(),
    message,
    target: session.channelName ?? STATUS_CHANNEL,
    time: new Date().toISOString(),
    category: MessageCategory.info,
    color,
  });
};

/**
 * True when `nick` has sent more than `OFFER_LIMIT` offers in the last minute.
 * A CTCP flood should not be able to fill the transfers panel.
 */
const isFlooding = (nick: string): boolean => {
  const now = Date.now();
  const key = nick.toLowerCase();
  const recent = (offerTimestamps.get(key) ?? []).filter((at) => now - at < OFFER_WINDOW_MS);
  recent.push(now);
  offerTimestamps.set(key, recent);
  return recent.length > OFFER_LIMIT;
};

const clearPendingTimer = (id: string): void => {
  const timer = pendingTimers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    pendingTimers.delete(id);
  }
};

const armPendingTimer = (id: string): void => {
  clearPendingTimer(id);
  pendingTimers.set(
    id,
    setTimeout(() => {
      pendingTimers.delete(id);
      const session = getDccSession(id);
      if (session?.status === DccStatus.pending) {
        updateDccSession(id, { status: DccStatus.declined });
        statusMessage(i18next.t('dcc.expired', { nick: session.nick }));
      }
    }, PENDING_TIMEOUT_MS),
  );
};

/**
 * The address we will let connect to a port we are about to advertise, when we
 * can know it. Most networks cloak hostnames, and constraining the listener to
 * a cloak would reject the real peer — so this narrows the window only when the
 * user's host is a literal IP, and leaves the port open otherwise.
 */
const knownPeerAddress = (nick: string): string | undefined => {
  const hostname = getUser(nick)?.hostname;
  return hostname !== undefined && hostname.length > 0 && isIpLiteral(hostname)
    ? hostname
    : undefined;
};

const sendCtcp = (nick: string, payload: string): void => {
  ircSendRawMessage(`PRIVMSG ${nick} :\x01${payload}\x01`);
};

/** Tell the peer we are not taking the offer, the way mIRC/HexChat do. */
const sendReject = (nick: string, offer: DccOffer): void => {
  const type = offer.kind === DccKind.chat ? 'CHAT' : 'SEND';
  const what = offer.kind === DccKind.chat ? 'chat' : (offer.filename ?? 'file');
  sendCtcp(nick, `DCC REJECT ${type} ${what}`);
};

const rejectReasonText = (reason: DccRejectReason, nick: string): string =>
  i18next.t(`dcc.reject.${reason}`, { nick, defaultValue: i18next.t('dcc.reject.malformed', { nick }) });

const failSession = (id: string, message: string): void => {
  clearPendingTimer(id);
  updateDccSession(id, { status: DccStatus.failed, error: message });
  const session = getDccSession(id);
  if (session) {
    sessionMessage(session, message, MessageColor.error);
  }
};

/**
 * Route one transport event into store + UI updates. Shared by both directions
 * and both kinds, because the transport already normalises them.
 */
const handleTransportEvent = (id: string, event: DccTransportEvent): void => {
  const session = getDccSession(id);
  if (session === undefined) {
    return;
  }

  switch (event.type) {
    case 'listening':
      updateDccSession(id, { status: DccStatus.connecting, port: event.port });
      break;

    case 'connected':
      updateDccSession(id, {
        status: DccStatus.active,
        fingerprint: event.fingerprint,
      });
      if (session.kind === DccKind.chat) {
        sessionMessage(
          session,
          event.fingerprint !== undefined
            ? i18next.t('dcc.chatConnectedSecure', { nick: session.nick, fingerprint: event.fingerprint })
            : i18next.t('dcc.chatConnected', { nick: session.nick }),
        );
      }
      break;

    case 'line':
      setAddMessage({
        id: uuidv4(),
        message: event.text,
        nick: session.nick,
        target: session.channelName ?? STATUS_CHANNEL,
        time: new Date().toISOString(),
        category: MessageCategory.default,
        color: MessageColor.default,
      });
      break;

    case 'progress': {
      const elapsed = Math.max(1, Date.now() - session.startedAt) / 1000;
      updateDccSession(id, {
        status: DccStatus.active,
        transferred: event.transferred,
        rate: Math.round(event.transferred / elapsed),
      });
      break;
    }

    case 'completed':
      clearPendingTimer(id);
      updateDccSession(id, {
        status: DccStatus.completed,
        path: event.path,
        transferred: session.size,
      });
      statusMessage(
        session.direction === DccDirection.incoming
          ? i18next.t('dcc.received', { filename: session.filename, nick: session.nick })
          : i18next.t('dcc.sent', { filename: session.filename, nick: session.nick }),
      );
      break;

    case 'closed':
      clearPendingTimer(id);
      // A chat window closing cleanly is not a failure; an unfinished transfer
      // is — the peer went away mid-stream.
      if (session.status === DccStatus.active && session.kind === DccKind.chat) {
        updateDccSession(id, { status: DccStatus.completed });
        sessionMessage(session, i18next.t('dcc.chatClosed', { nick: session.nick }));
      } else if (session.status !== DccStatus.completed) {
        failSession(id, i18next.t('dcc.errorClosed', { nick: session.nick }));
      }
      break;

    case 'error':
      failSession(id, i18next.t('dcc.errorPeer', { nick: session.nick, message: event.message }));
      break;
  }
};

/**
 * Entry point from the IRC kernel: the params of a `\x01DCC ...\x01` CTCP.
 * Returns true when the payload was a DCC message we consumed, so the kernel
 * knows not to fall through to the generic CTCP auto-reply.
 */
export const handleDccCtcp = (nick: string, params: string): void => {
  const settings = getDccSettings();

  // REJECT is the peer declining something we offered; it carries no address.
  if (/^REJECT\b/i.test(params)) {
    const outgoing = useDccSessionsStore
      .getState()
      .sessions.find(
        (session) =>
          session.nick.toLowerCase() === nick.toLowerCase() &&
          session.direction === DccDirection.outgoing &&
          (session.status === DccStatus.connecting || session.status === DccStatus.pending),
      );
    if (outgoing) {
      clearPendingTimer(outgoing.id);
      updateDccSession(outgoing.id, { status: DccStatus.declined });
      void getDccTransport().close(outgoing.id).catch(() => undefined);
    }
    statusMessage(i18next.t('dcc.peerDeclined', { nick }));
    return;
  }

  if (!settings.enabled) {
    return;
  }

  if (isFlooding(nick)) {
    // Say nothing to the peer — replying is what makes a flood amplify.
    return;
  }

  const result = parseDccCtcp(params, {
    allowPrivateAddress: settings.allowPrivateAddress,
    maxFileSize: settings.maxFileSize,
  });

  if (!result.ok) {
    statusMessage(rejectReasonText(result.reason, nick), MessageColor.error);
    return;
  }

  const { offer } = result;

  if (settings.secureOnly && !offer.secure) {
    statusMessage(i18next.t('dcc.reject.insecure', { nick }), MessageColor.error);
    sendReject(nick, offer);
    return;
  }

  if (!isDccAvailable()) {
    statusMessage(i18next.t('dcc.unsupported', { nick }), MessageColor.error);
    sendReject(nick, offer);
    return;
  }

  const id = uuidv4();
  const now = Date.now();

  addDccSession({
    id,
    kind: offer.kind,
    direction: DccDirection.incoming,
    status: DccStatus.pending,
    secure: offer.secure,
    nick,
    host: offer.host,
    port: offer.port,
    filename: offer.filename,
    size: offer.size,
    transferred: offer.kind === DccKind.send ? 0 : undefined,
    startedAt: now,
    updatedAt: now,
  });

  armPendingTimer(id);

  statusMessage(
    offer.kind === DccKind.chat
      ? i18next.t('dcc.offerChat', { nick, secure: offer.secure ? i18next.t('dcc.secureTag') : '' })
      : i18next.t('dcc.offerSend', { nick, filename: offer.filename, size: offer.size }),
  );
};

/** Accept a pending incoming offer: dial the peer and start moving data. */
export const acceptDccOffer = async (id: string): Promise<void> => {
  const session = getDccSession(id);
  if (session === undefined || session.status !== DccStatus.pending) {
    return;
  }

  clearPendingTimer(id);
  const transport = getDccTransport();
  const settings = getDccSettings();

  try {
    let savePath: string | undefined;

    if (session.kind === DccKind.send) {
      const filename = session.filename ?? 'file';
      // Resolve inside the download directory, then step around an existing
      // file rather than overwriting whatever is already there.
      const basePath = await transport.resolveDownloadPath(settings.downloadDirectory, filename);
      const directory = basePath.slice(0, basePath.length - filename.length);
      let candidate = filename;
      let index = 0;
      // `dedupeFilename` needs a synchronous predicate, so probe first.
      const takenNames = new Set<string>();
      while (index < 100 && (await transport.exists(directory + candidate))) {
        takenNames.add(candidate);
        candidate = dedupeFilename(filename, (name) => takenNames.has(name));
        index += 1;
      }
      savePath = directory + candidate;
      updateDccSession(id, { filename: candidate, path: savePath });
    } else {
      const channelName = dccChatChannelName(session.nick);
      if (!existChannel(channelName)) {
        setAddChannel(channelName, ChannelCategory.dcc);
      }
      updateDccSession(id, { channelName });
    }

    updateDccSession(id, { status: DccStatus.connecting });

    await transport.connect(
      id,
      {
        host: session.host,
        port: session.port,
        secure: session.secure,
        savePath,
        size: session.size,
      },
      (event) => {
        handleTransportEvent(id, event);
      },
    );
  } catch (err) {
    failSession(id, i18next.t('dcc.errorConnect', { message: String(err) }));
  }
};

/** Decline a pending incoming offer and tell the peer. */
export const declineDccOffer = (id: string): void => {
  const session = getDccSession(id);
  if (session === undefined || session.status !== DccStatus.pending) {
    return;
  }
  clearPendingTimer(id);
  updateDccSession(id, { status: DccStatus.declined });
  sendReject(session.nick, {
    kind: session.kind,
    secure: session.secure,
    host: session.host,
    port: session.port,
    filename: session.filename,
    size: session.size,
  });
};

/** Cancel an in-flight session in either direction. */
export const cancelDccSession = async (id: string): Promise<void> => {
  const session = getDccSession(id);
  if (session === undefined) {
    return;
  }
  clearPendingTimer(id);
  updateDccSession(id, { status: DccStatus.cancelled });
  await getDccTransport()
    .close(id)
    .catch(() => undefined);
};

interface OfferOptions {
  nick: string;
  secure: boolean;
}

/** Offer a DCC (S)CHAT to `nick`: listen first, then advertise the address. */
export const offerDccChat = async ({ nick, secure }: OfferOptions): Promise<void> => {
  if (!isDccAvailable()) {
    statusMessage(i18next.t('dcc.unsupportedLocal'), MessageColor.error);
    return;
  }

  const settings = getDccSettings();
  const id = uuidv4();
  const now = Date.now();
  const channelName = dccChatChannelName(nick);

  addDccSession({
    id,
    kind: DccKind.chat,
    direction: DccDirection.outgoing,
    status: DccStatus.connecting,
    secure,
    nick,
    host: '',
    port: 0,
    channelName,
    startedAt: now,
    updatedAt: now,
  });

  if (!existChannel(channelName)) {
    setAddChannel(channelName, ChannelCategory.dcc);
  }

  try {
    const bound = await getDccTransport().listen(
      id,
      {
        secure,
        portRange: [settings.portRangeStart, settings.portRangeEnd],
        expectPeer: knownPeerAddress(nick),
      },
      (event) => {
        handleTransportEvent(id, event);
      },
    );

    const host = settings.advertisedHost ?? bound.host;
    updateDccSession(id, { host, port: bound.port });
    sendCtcp(nick, formatDccCtcp({ kind: DccKind.chat, secure, host, port: bound.port }));
    statusMessage(i18next.t('dcc.offeredChat', { nick }));
  } catch (err) {
    failSession(id, i18next.t('dcc.errorListen', { message: String(err) }));
  }
};

/** Offer a file to `nick`. `filePath`/`filename`/`size` come from the picker. */
export const offerDccSend = async ({
  nick,
  secure,
  filePath,
  filename,
  size,
}: OfferOptions & { filePath: string; filename: string; size: number }): Promise<void> => {
  if (!isDccAvailable()) {
    statusMessage(i18next.t('dcc.unsupportedLocal'), MessageColor.error);
    return;
  }

  const settings = getDccSettings();
  const id = uuidv4();
  const now = Date.now();

  addDccSession({
    id,
    kind: DccKind.send,
    direction: DccDirection.outgoing,
    status: DccStatus.connecting,
    secure,
    nick,
    host: '',
    port: 0,
    filename,
    size,
    transferred: 0,
    path: filePath,
    startedAt: now,
    updatedAt: now,
  });

  try {
    const bound = await getDccTransport().listen(
      id,
      {
        secure,
        portRange: [settings.portRangeStart, settings.portRangeEnd],
        expectPeer: knownPeerAddress(nick),
        filePath,
      },
      (event) => {
        handleTransportEvent(id, event);
      },
    );

    const host = settings.advertisedHost ?? bound.host;
    updateDccSession(id, { host, port: bound.port });
    sendCtcp(
      nick,
      formatDccCtcp({ kind: DccKind.send, secure, host, port: bound.port, filename, size }),
    );
    statusMessage(i18next.t('dcc.offeredSend', { nick, filename }));
  } catch (err) {
    failSession(id, i18next.t('dcc.errorListen', { message: String(err) }));
  }
};

/**
 * Send one line of chat typed into a DCC window. Returns false when the window
 * has no live session, so the caller can tell the user instead of silently
 * swallowing the text.
 */
export const sendDccChatLine = (channelName: string, text: string): boolean => {
  const session = getDccSessionByChannel(channelName);
  if (session === undefined || session.status !== DccStatus.active) {
    return false;
  }

  void getDccTransport()
    .sendLine(session.id, text)
    .catch((err: unknown) => {
      failSession(session.id, i18next.t('dcc.errorSend', { message: String(err) }));
    });

  setAddMessage({
    id: uuidv4(),
    message: text,
    nick: getCurrentNick(),
    target: channelName,
    time: new Date().toISOString(),
    category: MessageCategory.default,
    color: MessageColor.default,
  });

  return true;
};

/** Test seam: drop rate-limit and timer state between cases. */
export const resetDccManagerState = (): void => {
  for (const timer of pendingTimers.values()) {
    clearTimeout(timer);
  }
  pendingTimers.clear();
  offerTimestamps.clear();
};
