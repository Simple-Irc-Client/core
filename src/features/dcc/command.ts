/**
 * `/dcc` command handling.
 *
 * Lives in the feature slice rather than in `network/irc/command.ts` because
 * none of it produces an IRC line — the CTCP offer is sent by the manager once
 * a listening socket actually exists and its port is known.
 *
 *   /dcc chat  <nick>          /dcc schat <nick>
 *   /dcc send  <nick> [path]   /dcc ssend <nick> [path]
 *   /dcc close <nick>
 *   /dcc list
 */
import { v4 as uuidv4 } from 'uuid';
import i18next from '@/app/i18n';
import { STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { MessageCategory } from '@shared/types';
import { setAddMessage } from '@features/channels/store/channels';
import { isValidNick } from '@shared/lib/utils';
import {
  cancelDccSession,
  dccChatChannelName,
  isDccChatChannel,
  offerDccChat,
  offerDccSend,
} from './manager';
import { isDccFinished, useDccSessionsStore } from './store/dcc';
import { pickFileToSend, statFileToSend } from './transport';
import { DccStatus } from './types';

const notify = (message: string, color: MessageColor = MessageColor.info): void => {
  setAddMessage({
    id: uuidv4(),
    message,
    target: STATUS_CHANNEL,
    time: new Date().toISOString(),
    category: MessageCategory.info,
    color,
  });
};

/**
 * Resolve the nick a subcommand applies to. In a DCC chat window (`=nick`) or a
 * query the target is implicit, so `/dcc close` on its own works there.
 */
const resolveNick = (channel: string, explicit: string | undefined): string | null => {
  if (explicit !== undefined && explicit.length > 0) {
    return isValidNick(explicit) ? explicit : null;
  }
  if (isDccChatChannel(channel)) {
    return channel.slice(1);
  }
  if (!channel.startsWith('#') && !channel.startsWith('&') && channel !== STATUS_CHANNEL) {
    return channel;
  }
  return null;
};

const startSend = async (nick: string, secure: boolean, pathArg: string | undefined): Promise<void> => {
  try {
    // A path typed on the command line still has to be stat'ed natively: the
    // offer must carry the real byte count, and a path that is not a readable
    // file has to fail before anything is advertised over IRC. The picker
    // returns the same shape, so both routes converge.
    const picked =
      pathArg !== undefined && pathArg.length > 0
        ? await statFileToSend(pathArg)
        : await pickFileToSend();

    // The picker returns null when the user cancels — not an error.
    if (picked === null) {
      return;
    }

    await offerDccSend({
      nick,
      secure,
      filePath: picked.path,
      filename: picked.name,
      size: picked.size,
    });
  } catch (err) {
    notify(i18next.t('dcc.errorFile', { message: String(err) }), MessageColor.error);
  }
};

const listSessions = (): void => {
  const { sessions } = useDccSessionsStore.getState();
  const active = sessions.filter((session) => !isDccFinished(session.status));

  if (active.length === 0) {
    notify(i18next.t('dcc.listEmpty'));
    return;
  }

  for (const session of active) {
    notify(
      i18next.t('dcc.listEntry', {
        kind: session.kind,
        nick: session.nick,
        status: session.status,
        detail: session.filename ?? dccChatChannelName(session.nick),
      }),
    );
  }
};

const closeSessions = (nick: string): void => {
  const targets = useDccSessionsStore
    .getState()
    .sessions.filter(
      (session) =>
        session.nick.toLowerCase() === nick.toLowerCase() &&
        (session.status === DccStatus.active || session.status === DccStatus.connecting),
    );

  if (targets.length === 0) {
    notify(i18next.t('dcc.nothingToClose', { nick }));
    return;
  }

  for (const session of targets) {
    void cancelDccSession(session.id);
  }
};

/** Entry point from `parseMessageToCommand`. Never throws. */
export const runDccCommand = (channel: string, line: string[]): void => {
  const sub = line[0]?.toLowerCase();

  if (sub === undefined || sub.length === 0 || sub === 'help') {
    notify(i18next.t('dcc.usage'));
    return;
  }

  if (sub === 'list') {
    listSessions();
    return;
  }

  const nick = resolveNick(channel, line[1]);
  if (nick === null) {
    notify(i18next.t('dcc.needNick'), MessageColor.error);
    return;
  }

  switch (sub) {
    case 'chat':
      void offerDccChat({ nick, secure: false });
      return;
    case 'schat':
      void offerDccChat({ nick, secure: true });
      return;
    case 'send':
      void startSend(nick, false, line.slice(2).join(' ') || undefined);
      return;
    case 'ssend':
      void startSend(nick, true, line.slice(2).join(' ') || undefined);
      return;
    case 'close':
      closeSessions(nick);
      return;
    default:
      notify(i18next.t('dcc.usage'));
  }
};
