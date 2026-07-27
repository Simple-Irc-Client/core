/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sentLines: string[] = [];
const addedMessages: { message: string; target: string }[] = [];
const addedChannels: { name: string; category: string }[] = [];

vi.mock('@/network/irc/network', () => ({
  ircSendRawMessage: (line: string) => {
    sentLines.push(line);
  },
}));

vi.mock('@features/channels/store/channels', () => ({
  setAddMessage: (message: { message: string; target: string }) => {
    addedMessages.push({ message: message.message, target: message.target });
  },
  setAddChannel: (name: string, category: string) => {
    addedChannels.push({ name, category });
  },
  existChannel: (name: string) => addedChannels.some((channel) => channel.name === name),
}));

vi.mock('@features/settings/store/settings', () => ({
  getCurrentNick: () => 'me',
}));

let peerHostname = '';
vi.mock('@features/users/store/users', () => ({
  getUser: (nick: string) =>
    peerHostname === '' ? undefined : { nick, ident: 'u', hostname: peerHostname },
}));

// i18next is only used for display strings; echoing the key keeps assertions
// about *which* message was produced readable and locale-independent.
vi.mock('@/app/i18n', () => ({
  default: { t: (key: string) => key },
}));

const transport = {
  available: true,
  listen: vi.fn(),
  connect: vi.fn(),
  sendLine: vi.fn(),
  close: vi.fn(),
  resolveDownloadPath: vi.fn(),
  exists: vi.fn(),
};
let dccAvailable = true;

vi.mock('../transport', () => ({
  getDccTransport: () => transport,
  isDccAvailable: () => dccAvailable,
  pickFileToSend: vi.fn(),
  pickDownloadDirectory: vi.fn(),
}));

const {
  acceptDccOffer,
  declineDccOffer,
  handleDccCtcp,
  offerDccChat,
  resetDccManagerState,
  sendDccChatLine,
} = await import('../manager');
const { DEFAULT_DCC_SETTINGS, useDccSessionsStore, useDccSettingsStore } = await import('../store/dcc');
const { DccStatus, DccDirection } = await import('../types');

// 3467383817 === 206.172.20.9, a routable address the private-address guard
// lets through.
const OFFER_CHAT = 'CHAT chat 3467383817 5000';
const OFFER_SEND = 'SEND holiday.jpg 3467383817 5000 2048';

const sessions = () => useDccSessionsStore.getState().sessions;

beforeEach(() => {
  sentLines.length = 0;
  addedMessages.length = 0;
  addedChannels.length = 0;
  dccAvailable = true;
  peerHostname = '';
  resetDccManagerState();
  useDccSessionsStore.setState({ sessions: [] });
  useDccSettingsStore.setState({ settings: { ...DEFAULT_DCC_SETTINGS } });
  transport.listen.mockReset().mockResolvedValue({ host: '10.1.2.3', port: 41234 });
  transport.connect.mockReset().mockResolvedValue(undefined);
  transport.sendLine.mockReset().mockResolvedValue(undefined);
  transport.close.mockReset().mockResolvedValue(undefined);
  transport.resolveDownloadPath.mockReset().mockResolvedValue('/home/me/Downloads/holiday.jpg');
  transport.exists.mockReset().mockResolvedValue(false);
  vi.useRealTimers();
});

afterEach(() => {
  resetDccManagerState();
  vi.useRealTimers();
});

describe('handleDccCtcp', () => {
  it('records a chat offer as pending without touching the socket', () => {
    handleDccCtcp('alice', OFFER_CHAT);

    expect(sessions()).toHaveLength(1);
    expect(sessions()[0]).toMatchObject({
      nick: 'alice',
      kind: 'chat',
      status: DccStatus.pending,
      direction: DccDirection.incoming,
      host: '206.172.20.9',
      port: 5000,
      secure: false,
    });
    expect(transport.connect).not.toHaveBeenCalled();
  });

  it('records a send offer with the sanitised filename and size', () => {
    handleDccCtcp('alice', OFFER_SEND);

    expect(sessions()[0]).toMatchObject({
      kind: 'send',
      filename: 'holiday.jpg',
      size: 2048,
      transferred: 0,
    });
  });

  it('marks SCHAT and SSEND as secure', () => {
    handleDccCtcp('alice', 'SCHAT chat 3467383817 5000');
    handleDccCtcp('bob', 'SSEND a.bin 3467383817 5000 1');

    expect(sessions().every((session) => session.secure)).toBe(true);
  });

  it('creates nothing and warns when the offer is malformed', () => {
    handleDccCtcp('alice', 'CHAT chat notanaddress 5000');

    expect(sessions()).toHaveLength(0);
    expect(addedMessages.at(-1)?.message).toBe('dcc.reject.badAddress');
  });

  it('rejects a private-address offer unless the user opted in', () => {
    handleDccCtcp('alice', 'CHAT chat 3232235777 5000');
    expect(sessions()).toHaveLength(0);
    expect(addedMessages.at(-1)?.message).toBe('dcc.reject.privateAddress');

    useDccSettingsStore.getState().setDccSettings({ allowPrivateAddress: true });
    handleDccCtcp('alice', 'CHAT chat 3232235777 5000');
    expect(sessions()).toHaveLength(1);
  });

  it('refuses unencrypted offers and tells the peer when secureOnly is set', () => {
    useDccSettingsStore.getState().setDccSettings({ secureOnly: true });

    handleDccCtcp('alice', OFFER_SEND);

    expect(sessions()).toHaveLength(0);
    expect(sentLines).toEqual(['PRIVMSG alice :\x01DCC REJECT SEND holiday.jpg\x01']);
  });

  it('does nothing at all when DCC is disabled', () => {
    useDccSettingsStore.getState().setDccSettings({ enabled: false });

    handleDccCtcp('alice', OFFER_CHAT);

    expect(sessions()).toHaveLength(0);
    expect(sentLines).toHaveLength(0);
    expect(addedMessages).toHaveLength(0);
  });

  it('auto-declines with an explanation when the platform has no sockets', () => {
    dccAvailable = false;

    handleDccCtcp('alice', OFFER_CHAT);

    expect(sessions()).toHaveLength(0);
    expect(addedMessages.at(-1)?.message).toBe('dcc.unsupported');
    expect(sentLines).toEqual(['PRIVMSG alice :\x01DCC REJECT CHAT chat\x01']);
  });

  it('stops recording after a burst from one nick, but not from another', () => {
    for (let i = 0; i < 8; i += 1) {
      handleDccCtcp('flooder', OFFER_CHAT);
    }
    expect(sessions()).toHaveLength(5);

    handleDccCtcp('alice', OFFER_CHAT);
    expect(sessions()).toHaveLength(6);
  });

  it('never answers a flood, so it cannot be amplified', () => {
    for (let i = 0; i < 8; i += 1) {
      handleDccCtcp('flooder', 'CHAT chat notanaddress 5000');
    }
    expect(sentLines).toHaveLength(0);
  });

  it('marks our outgoing offer declined when the peer sends DCC REJECT', async () => {
    await offerDccChat({ nick: 'alice', secure: false });
    expect(sessions()[0]?.status).toBe(DccStatus.connecting);

    handleDccCtcp('alice', 'REJECT CHAT chat');

    expect(sessions()[0]?.status).toBe(DccStatus.declined);
    expect(transport.close).toHaveBeenCalled();
  });

  it('expires a pending offer the user never answered', () => {
    vi.useFakeTimers();
    handleDccCtcp('alice', OFFER_CHAT);
    expect(sessions()[0]?.status).toBe(DccStatus.pending);

    vi.advanceTimersByTime(120_001);

    expect(sessions()[0]?.status).toBe(DccStatus.declined);
    expect(addedMessages.at(-1)?.message).toBe('dcc.expired');
  });
});

describe('acceptDccOffer', () => {
  it('opens a DCC chat window and dials the peer', async () => {
    handleDccCtcp('alice', OFFER_CHAT);
    await acceptDccOffer(sessions()[0]?.id ?? '');

    expect(addedChannels).toEqual([{ name: '=alice', category: 'dcc' }]);
    expect(transport.connect).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ host: '206.172.20.9', port: 5000, secure: false }),
      expect.any(Function),
    );
  });

  it('writes an incoming file into the download folder', async () => {
    handleDccCtcp('alice', OFFER_SEND);
    await acceptDccOffer(sessions()[0]?.id ?? '');

    expect(transport.connect).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ savePath: '/home/me/Downloads/holiday.jpg', size: 2048 }),
      expect.any(Function),
    );
  });

  it('steps around an existing file instead of overwriting it', async () => {
    transport.exists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    handleDccCtcp('alice', OFFER_SEND);
    await acceptDccOffer(sessions()[0]?.id ?? '');

    expect(sessions()[0]?.filename).toBe('holiday (1).jpg');
    expect(transport.connect).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ savePath: '/home/me/Downloads/holiday (1).jpg' }),
      expect.any(Function),
    );
  });

  it('fails the session when the connection cannot be made', async () => {
    transport.connect.mockRejectedValue(new Error('ECONNREFUSED'));

    handleDccCtcp('alice', OFFER_CHAT);
    await acceptDccOffer(sessions()[0]?.id ?? '');

    expect(sessions()[0]?.status).toBe(DccStatus.failed);
    expect(sessions()[0]?.error).toBe('dcc.errorConnect');
  });

  it('ignores a second accept for the same offer', async () => {
    handleDccCtcp('alice', OFFER_CHAT);
    const id = sessions()[0]?.id ?? '';
    await acceptDccOffer(id);
    await acceptDccOffer(id);

    expect(transport.connect).toHaveBeenCalledTimes(1);
  });
});

describe('declineDccOffer', () => {
  it('tells the peer and marks the row declined', () => {
    handleDccCtcp('alice', OFFER_SEND);
    declineDccOffer(sessions()[0]?.id ?? '');

    expect(sessions()[0]?.status).toBe(DccStatus.declined);
    expect(sentLines).toEqual(['PRIVMSG alice :\x01DCC REJECT SEND holiday.jpg\x01']);
  });

  it('does nothing for an already-answered offer', () => {
    handleDccCtcp('alice', OFFER_CHAT);
    const id = sessions()[0]?.id ?? '';
    declineDccOffer(id);
    declineDccOffer(id);

    expect(sentLines).toHaveLength(1);
  });
});

describe('offerDccChat', () => {
  it('advertises the bound port as a CTCP after the socket is listening', async () => {
    await offerDccChat({ nick: 'alice', secure: true });

    expect(transport.listen).toHaveBeenCalled();
    expect(sentLines).toEqual(['PRIVMSG alice :\x01DCC SCHAT chat 167838211 41234\x01']);
  });

  it('advertises the configured external address when one is set', async () => {
    useDccSettingsStore.getState().setDccSettings({ advertisedHost: '206.172.20.9' });

    await offerDccChat({ nick: 'alice', secure: false });

    expect(sentLines).toEqual(['PRIVMSG alice :\x01DCC CHAT chat 3467383817 41234\x01']);
  });

  it('pins the listener to the peer when their host is a literal IP', async () => {
    peerHostname = '198.51.100.7';

    await offerDccChat({ nick: 'alice', secure: false });

    expect(transport.listen).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ expectPeer: '198.51.100.7' }),
      expect.any(Function),
    );
  });

  it('leaves the listener open when the peer host is a cloak', async () => {
    // Constraining on a cloak would reject the real peer, so we must not.
    peerHostname = 'D6D788C7.623ED634.C8132F93.IP';

    await offerDccChat({ nick: 'alice', secure: false });

    expect(transport.listen).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ expectPeer: undefined }),
      expect.any(Function),
    );
  });

  it('sends nothing and fails the row when the port cannot be opened', async () => {
    transport.listen.mockRejectedValue(new Error('EACCES'));

    await offerDccChat({ nick: 'alice', secure: false });

    expect(sentLines).toHaveLength(0);
    expect(sessions()[0]?.status).toBe(DccStatus.failed);
  });

  it('refuses on a platform without sockets', async () => {
    dccAvailable = false;

    await offerDccChat({ nick: 'alice', secure: false });

    expect(transport.listen).not.toHaveBeenCalled();
    expect(addedMessages.at(-1)?.message).toBe('dcc.unsupportedLocal');
  });
});

describe('sendDccChatLine', () => {
  it('refuses to send when the window has no active session', () => {
    expect(sendDccChatLine('=nobody', 'hello')).toBe(false);
    expect(transport.sendLine).not.toHaveBeenCalled();
  });

  it('sends over the socket and echoes locally once active', async () => {
    handleDccCtcp('alice', OFFER_CHAT);
    const id = sessions()[0]?.id ?? '';
    await acceptDccOffer(id);
    // Drive the transport callback the way the platform would.
    const onEvent = transport.connect.mock.calls[0]?.[2] as (event: unknown) => void;
    onEvent({ type: 'connected' });

    expect(sendDccChatLine('=alice', 'hello')).toBe(true);
    expect(transport.sendLine).toHaveBeenCalledWith(id, 'hello');
    expect(addedMessages.at(-1)).toEqual({ message: 'hello', target: '=alice' });
    // Nothing may reach IRC from inside a DCC window.
    expect(sentLines).toHaveLength(0);
  });
});

describe('transport events', () => {
  const driveAcceptedSend = async (): Promise<(event: unknown) => void> => {
    handleDccCtcp('alice', OFFER_SEND);
    await acceptDccOffer(sessions()[0]?.id ?? '');
    return transport.connect.mock.calls[0]?.[2] as (event: unknown) => void;
  };

  it('tracks progress and completion', async () => {
    const onEvent = await driveAcceptedSend();

    onEvent({ type: 'connected' });
    onEvent({ type: 'progress', transferred: 1024 });
    expect(sessions()[0]).toMatchObject({ status: DccStatus.active, transferred: 1024 });

    onEvent({ type: 'completed', path: '/home/me/Downloads/holiday.jpg' });
    expect(sessions()[0]?.status).toBe(DccStatus.completed);
    expect(addedMessages.at(-1)?.message).toBe('dcc.received');
  });

  it('fails a transfer the peer cut short', async () => {
    const onEvent = await driveAcceptedSend();

    onEvent({ type: 'connected' });
    onEvent({ type: 'progress', transferred: 512 });
    onEvent({ type: 'closed' });

    expect(sessions()[0]?.status).toBe(DccStatus.failed);
    expect(sessions()[0]?.error).toBe('dcc.errorClosed');
  });

  it('does not resurrect a completed transfer on the trailing close', async () => {
    const onEvent = await driveAcceptedSend();

    onEvent({ type: 'connected' });
    onEvent({ type: 'completed' });
    onEvent({ type: 'closed' });

    expect(sessions()[0]?.status).toBe(DccStatus.completed);
  });

  it('surfaces a peer error', async () => {
    const onEvent = await driveAcceptedSend();

    onEvent({ type: 'error', message: 'TLS handshake failed' });

    expect(sessions()[0]?.status).toBe(DccStatus.failed);
    expect(sessions()[0]?.error).toBe('dcc.errorPeer');
  });

  it('treats a closed chat as a normal end, not a failure', async () => {
    handleDccCtcp('alice', OFFER_CHAT);
    await acceptDccOffer(sessions()[0]?.id ?? '');
    const onEvent = transport.connect.mock.calls[0]?.[2] as (event: unknown) => void;

    onEvent({ type: 'connected' });
    onEvent({ type: 'closed' });

    expect(sessions()[0]?.status).toBe(DccStatus.completed);
    expect(addedMessages.at(-1)?.message).toBe('dcc.chatClosed');
  });

  it('records the TLS fingerprint for a secure chat', async () => {
    handleDccCtcp('alice', 'SCHAT chat 3467383817 5000');
    await acceptDccOffer(sessions()[0]?.id ?? '');
    const onEvent = transport.connect.mock.calls[0]?.[2] as (event: unknown) => void;

    onEvent({ type: 'connected', fingerprint: 'ab:cd' });

    expect(sessions()[0]?.fingerprint).toBe('ab:cd');
    expect(addedMessages.at(-1)?.message).toBe('dcc.chatConnectedSecure');
  });

  it('routes an incoming chat line into the DCC window', async () => {
    handleDccCtcp('alice', OFFER_CHAT);
    await acceptDccOffer(sessions()[0]?.id ?? '');
    const onEvent = transport.connect.mock.calls[0]?.[2] as (event: unknown) => void;

    onEvent({ type: 'connected' });
    onEvent({ type: 'line', text: 'hi there' });

    expect(addedMessages.at(-1)).toEqual({ message: 'hi there', target: '=alice' });
  });
});
