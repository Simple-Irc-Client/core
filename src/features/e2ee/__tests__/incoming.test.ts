import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import type { Message } from '@shared/types';

const sentLines: string[] = [];
const addedMessages: Message[] = [];
const updatedMessages: { channel: string; id: string; patch: Partial<Message> }[] = [];
const unreadBumps: string[] = [];
const notifications: { nick: string; message: string }[] = [];

vi.mock('@/network/irc/network', () => ({
  ircSendRawMessage: (line: string): void => {
    sentLines.push(line);
  },
}));

vi.mock('@/features/settings/store/settings', () => ({
  getServer: (): { network: string } => ({ network: 'testnet' }),
  getCaseMapping: (): string => 'ascii',
  getCurrentNick: (): string => 'me',
  getCurrentChannelName: (): string => 'Status',
  isSameName: (a: string, b: string): boolean => a.toLowerCase() === b.toLowerCase(),
  getAutoOfferEncryption: (): boolean => false,
  // 0 = server never sent ISUPPORT LINELEN; chunking falls back to the default.
  getLineLenLimit: (): number => 0,
}));

vi.mock('@/features/users/store/users', () => ({
  getUser: (): undefined => undefined,
}));

vi.mock('@/features/channels/store/channels', () => ({
  existChannel: (): boolean => true,
  setAddChannel: vi.fn(),
  setAddMessage: (message: Message): void => {
    addedMessages.push(message);
  },
  setUpdateMessage: (channel: string, id: string, patch: Partial<Message>): void => {
    updatedMessages.push({ channel, id, patch });
  },
  setIncreaseUnreadMessages: (channel: string): void => {
    unreadBumps.push(channel);
  },
  setHasMention: vi.fn(),
  setTyping: vi.fn(),
}));

vi.mock('@/runtime/notifications', () => ({
  notifyHighlight: async ({ nick, message }: { nick: string; message: string }): Promise<void> => {
    notifications.push({ nick, message });
  },
}));

vi.mock('idb-keyval', () => {
  const store = new Map<string, unknown>();
  return {
    get: async (key: string): Promise<unknown> => store.get(key),
    set: async (key: string, value: unknown): Promise<void> => {
      store.set(key, value);
    },
    del: async (key: string): Promise<void> => {
      store.delete(key);
    },
  };
});

const { handleE2eeCtcp, clearIncomingState } = await import('../incoming');
const sessionModule = await import('../session');
const { resetSessionModuleForTests, acceptIncomingOffer } = sessionModule;
const { getSessionState, removeSession, E2eeState } = await import('../store/e2ee');
const { parseCtcpFrame, BodyKind } = await import('../protocol');
const { useE2eePinsStore } = await import('../store/pins');

const CTCP = '\x01';

/** Pull the CTCP body out of a raw line the session module emitted. */
const bodyOf = (line: string): string => {
  const start = line.indexOf(CTCP);
  const end = line.lastIndexOf(CTCP);
  return start === -1 || end <= start ? '' : line.slice(start + 1, end);
};

/**
 * Let the fire-and-forget promise chains inside `incoming.ts` settle.
 *
 * Draining microtasks is not enough: those chains await WebCrypto, whose
 * promises are settled by the host outside the microtask queue, so this has to
 * yield to the macrotask queue as well. Only sound for asserting that something
 * did *not* happen — use `until` for anything that has to happen, since a fixed
 * number of ticks is not a reliable bound on a key derivation.
 */
const flush = async (): Promise<void> => {
  for (let index = 0; index < 5; index++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

/** Wait for a condition the asynchronous receive path is expected to reach. */
const until = async (predicate: () => boolean, timeoutMs = 3000): Promise<void> => {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for the receive path to settle');
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

describe('e2ee incoming CTCP handling', () => {
  beforeEach(() => {
    sentLines.length = 0;
    addedMessages.length = 0;
    updatedMessages.length = 0;
    unreadBumps.length = 0;
    notifications.length = 0;
    resetSessionModuleForTests();
    clearIncomingState();
    localStorage.clear();
    // Each test stands up a brand-new peer with a brand-new identity. Without
    // clearing pins, the previous test's pin makes the next peer look exactly
    // like a key substitution — which is the store working, not a test bug.
    useE2eePinsStore.setState({ pinsByNetwork: {} });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('frames that are not ours', () => {
    it.each([
      ['a normal CTCP', 'VERSION'],
      ['an ACTION', 'ACTION waves'],
      ['garbage', 'SIC-E2EE NONSENSE'],
      ['a malformed cipher frame', 'SICE abc 9/2 QUJD'],
    ])('leaves %s to the standard CTCP handler', (_label, ctcpContent) => {
      expect(handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent, source: 'privmsg' })).toBe(false);
    });

    it('ignores an encryption frame aimed at a channel', () => {
      // This protocol is strictly one-to-one; a SICE sent to #chan is not
      // something we produce, so it must not reach the session machinery.
      const handled = handleE2eeCtcp({
        nick: 'bob',
        target: '#chan',
        ctcpContent: 'SICE abcd1234 1/1 QUJD',
        source: 'privmsg',
      });

      expect(handled).toBe(false);
      expect(addedMessages).toHaveLength(0);
    });

    it('ignores a cipher frame delivered as a NOTICE', () => {
      expect(
        handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: 'SICE abcd1234 1/1 QUJD', source: 'notice' }),
      ).toBe(false);
    });
  });

  describe('handshake', () => {
    it('consumes an offer and does not write to the Status window', async () => {
      const handled = handleE2eeCtcp({
        nick: 'bob',
        target: 'me',
        ctcpContent: 'SIC-E2EE OFFER 1 aWQ= ZXBo',
        source: 'privmsg',
      });
      await flush();

      expect(handled).toBe(true);
      // Keys are junk, so this ends in an error state — the point is that a
      // per-message CTCP notice pair never reaches Status.
      expect(addedMessages.some((message) => message.target === 'Status')).toBe(false);
    });

    it('drives the session to active against a real peer', async () => {
      // Stand up a second client to produce genuine frames.
      const peer = await createPeer();

      await peer.offerEncryption('me');
      const offer = parseCtcpFrame(bodyOf(peer.drain()[0] ?? ''));
      if (offer?.type !== 'offer') {
        throw new Error('expected an offer');
      }

      handleE2eeCtcp({
        nick: 'bob',
        target: 'me',
        ctcpContent: `SIC-E2EE OFFER 1 ${offer.identityKeyB64} ${offer.ephemeralKeyB64}`,
        source: 'privmsg',
      });
      await until(() => getSessionState('bob') === E2eeState.incoming);

      expect(getSessionState('bob')).toBe(E2eeState.incoming);
    });

    it('announces an inbound offer and bumps unread even when no window exists for the peer yet', async () => {
      const peer = await createPeer();
      await peer.offerEncryption('me');
      const offerBody = bodyOf(peer.drain()[0] ?? '');

      handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: offerBody, source: 'privmsg' });
      await until(() => getSessionState('bob') === E2eeState.incoming);

      expect(addedMessages.some((message) => message.target === 'bob')).toBe(true);
      expect(unreadBumps).toContain('bob');
    });
  });

  describe('cipher frames', () => {
    it('answers a frame we have no session for with a single RESET, then throttles', () => {
      for (let index = 0; index < 5; index++) {
        handleE2eeCtcp({
          nick: 'bob',
          target: 'me',
          ctcpContent: `SICE frame${index} 1/1 QUJDRA==`,
          source: 'privmsg',
        });
      }

      const resets = sentLines.filter((line) => line.includes('SIC-E2EE RESET'));
      expect(resets).toHaveLength(1);
      expect(addedMessages.filter((message) => message.category === 'info')).toHaveLength(1);
    });

    it('never renders a frame it cannot decrypt as message text', async () => {
      await establishSession();
      addedMessages.length = 0;
      updatedMessages.length = 0;

      handleE2eeCtcp({
        nick: 'bob',
        target: 'me',
        ctcpContent: 'SICE tampered 1/1 QUJDRAVGRkZGRkZGRkZGRkZGRkZGRkZGRkY=',
        source: 'privmsg',
        msgid: 'msg-1',
      });
      await until(() => updatedMessages.length > 0);

      // The placeholder goes in, then is patched to a failure — the raw bytes
      // are never shown as if they were a message from the peer.
      expect(addedMessages[0]).toMatchObject({ id: 'e2ee:msg-1', e2ee: 'decrypting' });
      expect(updatedMessages.at(-1)?.patch).toMatchObject({ e2ee: 'failed' });
      expect(notifications).toHaveLength(0);
    });

    it('renders a decrypted message in place, preserving arrival order', async () => {
      const peer = await establishSession();

      addedMessages.length = 0;
      updatedMessages.length = 0;

      await peer.sendEncrypted('me', 'the meeting is at six', BodyKind.message);
      for (const line of peer.drain()) {
        handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: bodyOf(line), source: 'privmsg', msgid: 'msg-42' });
      }
      await until(() => updatedMessages.length > 0);

      expect(addedMessages).toHaveLength(1);
      expect(addedMessages[0]).toMatchObject({ id: 'e2ee:msg-42', e2ee: 'decrypting' });
      expect(updatedMessages.at(-1)).toMatchObject({
        id: 'e2ee:msg-42',
        patch: { message: 'the meeting is at six', e2ee: 'ok' },
      });
      expect(notifications).toEqual([{ nick: 'bob', message: 'the meeting is at six' }]);
    });

    it('keeps two back-to-back messages in arrival order even if their decryptions settle the other way round', async () => {
      // The whole reason `handleCipher` inserts a placeholder synchronously
      // (see incoming.ts's file header) is that WebCrypto is not synchronous:
      // on a slow connection or a loaded machine, nothing guarantees the
      // *first* message's decryption is also the *first* to finish. Display
      // order must still follow arrival order, not whichever settles first.
      const peer = await establishSession();
      addedMessages.length = 0;
      updatedMessages.length = 0;

      await peer.sendEncrypted('me', 'first', BodyKind.message);
      const firstLines = peer.drain();
      await peer.sendEncrypted('me', 'second', BodyKind.message);
      const secondLines = peer.drain();

      // Both arrive before either decryption has had any chance to resolve —
      // no `await` between them, exactly as two lines arriving back-to-back
      // over the wire would be handled by the synchronous kernel dispatch.
      for (const line of firstLines) {
        handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: bodyOf(line), source: 'privmsg', msgid: 'first-id' });
      }
      for (const line of secondLines) {
        handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: bodyOf(line), source: 'privmsg', msgid: 'second-id' });
      }

      // Placeholders must already reflect arrival order at this point — before
      // any awaiting, and therefore before any decryption could possibly have
      // settled either way.
      expect(addedMessages).toHaveLength(2);
      expect(addedMessages[0]).toMatchObject({ id: 'e2ee:first-id', e2ee: 'decrypting' });
      expect(addedMessages[1]).toMatchObject({ id: 'e2ee:second-id', e2ee: 'decrypting' });

      await until(() => updatedMessages.length >= 2);

      const byId = (id: string): { message?: string } | undefined =>
        updatedMessages.find((update) => update.id === id)?.patch;
      expect(byId('e2ee:first-id')).toMatchObject({ message: 'first', e2ee: 'ok' });
      expect(byId('e2ee:second-id')).toMatchObject({ message: 'second', e2ee: 'ok' });
    });

    it('renders an encrypted /me as an action', async () => {
      const peer = await establishSession();
      updatedMessages.length = 0;

      await peer.sendEncrypted('me', 'waves slowly', BodyKind.action);
      for (const line of peer.drain()) {
        handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: bodyOf(line), source: 'privmsg', msgid: 'msg-me' });
      }
      await until(() => updatedMessages.length > 0);

      expect(updatedMessages.at(-1)?.patch).toMatchObject({ message: 'waves slowly', category: 'me', e2ee: 'ok' });
    });

    it('holds a partial message until every frame arrives', async () => {
      const peer = await establishSession();
      addedMessages.length = 0;

      await peer.sendEncrypted('me', 'x'.repeat(1200), BodyKind.message);
      const lines = peer.drain();
      expect(lines.length).toBeGreaterThan(1);

      // Feed all but the last frame: nothing should be rendered yet.
      for (const line of lines.slice(0, -1)) {
        handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: bodyOf(line), source: 'privmsg' });
      }
      await flush();
      expect(addedMessages).toHaveLength(0);

      handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: bodyOf(lines.at(-1) ?? ''), source: 'privmsg' });
      await until(() => updatedMessages.length > 0);
      expect(addedMessages).toHaveLength(1);
      expect(updatedMessages.at(-1)?.patch).toMatchObject({ message: 'x'.repeat(1200), e2ee: 'ok' });
    });

    it('bumps unread for a window that is not in view', async () => {
      const peer = await establishSession();
      unreadBumps.length = 0;

      await peer.sendEncrypted('me', 'ping', BodyKind.message);
      for (const line of peer.drain()) {
        handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: bodyOf(line), source: 'privmsg' });
      }
      await until(() => unreadBumps.length > 0);

      expect(unreadBumps).toContain('bob');
    });
  });

  describe('handshake verb enforcement', () => {
    /**
     * These must go through `handleE2eeCtcp`, not `handleHandshakeFrame`.
     * Testing the inner function directly is what let a bug ship where the
     * outer one synthesised the source from the frame type, so the verb check
     * could never fail in the code path the kernel actually uses.
     */
    it('ignores an OFFER delivered as a NOTICE', async () => {
      const peer = await createPeer();
      await peer.offerEncryption('me');
      const offerBody = bodyOf(peer.drain()[0] ?? '');

      handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: offerBody, source: 'notice' });
      await flush();

      expect(getSessionState('bob')).toBe(E2eeState.none);
    });

    it('accepts an OFFER delivered as a PRIVMSG', async () => {
      const peer = await createPeer();
      await peer.offerEncryption('me');
      const offerBody = bodyOf(peer.drain()[0] ?? '');

      handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: offerBody, source: 'privmsg' });
      await until(() => getSessionState('bob') === E2eeState.incoming);

      expect(getSessionState('bob')).toBe(E2eeState.incoming);
    });

    it('ignores a RESET delivered as a PRIVMSG', async () => {
      await establishSession();
      expect(getSessionState('bob')).toBe(E2eeState.active);

      handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: 'SIC-E2EE RESET', source: 'privmsg' });
      await flush();

      expect(getSessionState('bob')).toBe(E2eeState.active);
    });

    it('honours a RESET delivered as a NOTICE', async () => {
      await establishSession();

      handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: 'SIC-E2EE RESET', source: 'notice' });
      await until(() => getSessionState('bob') === E2eeState.none);

      expect(getSessionState('bob')).toBe(E2eeState.none);
    });

    it('ignores a DECLINE delivered as a PRIVMSG', async () => {
      const peer = await createPeer();
      await peer.offerEncryption('me');
      handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: bodyOf(peer.drain()[0] ?? ''), source: 'privmsg' });
      await until(() => getSessionState('bob') === E2eeState.incoming);

      handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: 'SIC-E2EE DECLINE', source: 'privmsg' });
      await flush();

      expect(getSessionState('bob')).toBe(E2eeState.incoming);
    });
  });

  describe('message identity', () => {
    it('namespaces the server msgid so it cannot collide with another message', async () => {
      const peer = await establishSession();
      addedMessages.length = 0;
      updatedMessages.length = 0;

      await peer.sendEncrypted('me', 'decrypted body', BodyKind.message);
      for (const line of peer.drain()) {
        handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: bodyOf(line), source: 'privmsg', msgid: 'collide' });
      }
      await until(() => updatedMessages.length > 0);

      // A server that reused `collide` for an earlier plaintext message must not
      // have that message's body replaced with this decrypted text.
      expect(addedMessages[0]?.id).toBe('e2ee:collide');
      expect(updatedMessages.at(-1)?.id).toBe('e2ee:collide');
      expect(addedMessages.some((message) => message.id === 'collide')).toBe(false);
    });

    it('still generates an id when the server sends no msgid', async () => {
      const peer = await establishSession();
      addedMessages.length = 0;
      updatedMessages.length = 0;

      await peer.sendEncrypted('me', 'no msgid here', BodyKind.message);
      for (const line of peer.drain()) {
        handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: bodyOf(line), source: 'privmsg' });
      }
      await until(() => updatedMessages.length > 0);

      expect(addedMessages[0]?.id).toMatch(/^e2ee:/);
    });
  });


  describe('offer flood protection', () => {
    /** A valid offer body from a freshly created peer. */
    const offerBodyFrom = async (): Promise<string> => {
      const peer = await createPeer();
      await peer.offerEncryption('me');
      return bodyOf(peer.drain()[0] ?? '');
    };

    it('stops acting on a flood from one peer', async () => {
      const offerBody = await offerBodyFrom();

      handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: offerBody, source: 'privmsg' });
      await until(() => getSessionState('bob') === E2eeState.incoming);
      removeSession('bob');

      for (let attempt = 0; attempt < 20; attempt++) {
        handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: offerBody, source: 'privmsg' });
      }
      await flush();

      // Refused before any key import or keypair generation, so nothing moved.
      expect(getSessionState('bob')).toBe(E2eeState.none);
    });

    it('swallows a throttled offer instead of passing it to the CTCP handler', async () => {
      const offerBody = await offerBodyFrom();

      handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: offerBody, source: 'privmsg' });
      await flush();

      // Still ours, so the kernel does not go on to answer it as unknown CTCP.
      expect(handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: offerBody, source: 'privmsg' })).toBe(true);
      expect(addedMessages.some((message) => message.target === 'Status')).toBe(false);
    });

    it('does not let one peer flooding block another', async () => {
      const offerBody = await offerBodyFrom();

      for (let index = 0; index < 40; index++) {
        handleE2eeCtcp({ nick: 'flooder', target: 'me', ctcpContent: offerBody, source: 'privmsg' });
      }
      await flush();

      // Throttling per peer rather than globally is what makes this hold — a
      // shared ceiling could be exhausted by a flood and used to force plaintext.
      handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: offerBody, source: 'privmsg' });
      await until(() => getSessionState('bob') === E2eeState.incoming);

      expect(getSessionState('bob')).toBe(E2eeState.incoming);
    });
  });


});

// --- Helpers that stand up a real second client ---

interface Peer {
  offerEncryption: typeof sessionModule.offerEncryption;
  handleHandshakeFrame: typeof import('../session').handleHandshakeFrame;
  sendEncrypted: typeof sessionModule.sendEncrypted;
  drain: () => string[];
}

/**
 * A second, independent copy of the session module standing in for the peer.
 * Its wire is captured separately so the two sides cannot see each other's
 * state by accident.
 */
const createPeer = async (): Promise<Peer> => {
  const peerLines: string[] = [];

  vi.resetModules();
  vi.doMock('@/network/irc/network', () => ({
    ircSendRawMessage: (line: string): void => {
      peerLines.push(line);
    },
  }));
  vi.doMock('@/features/settings/store/settings', () => ({
    getServer: (): { network: string } => ({ network: 'peernet' }),
    getCaseMapping: (): string => 'ascii',
    getAutoOfferEncryption: (): boolean => false,
    getCurrentNick: (): string => 'bob',
    getLineLenLimit: (): number => 0,
  }));
  vi.doMock('@/features/users/store/users', () => ({ getUser: (): undefined => undefined }));

  const module = await import('../session');

  return {
    offerEncryption: module.offerEncryption,
    handleHandshakeFrame: module.handleHandshakeFrame,
    sendEncrypted: module.sendEncrypted,
    drain: (): string[] => peerLines.splice(0, peerLines.length),
  };
};

/**
 * Complete a handshake between the module under test and a fresh peer.
 *
 * The local side must use the top-level imports: `vi.resetModules()` inside
 * `createPeer` means a later `await import('../session')` hands back the peer's
 * copy, not the instance `incoming.ts` is wired to.
 */
const establishSession = async (): Promise<Peer> => {
  const peer = await createPeer();

  await peer.offerEncryption('me');
  const offerLine = peer.drain()[0] ?? '';
  handleE2eeCtcp({ nick: 'bob', target: 'me', ctcpContent: bodyOf(offerLine), source: 'privmsg' });
  await until(() => getSessionState('bob') === E2eeState.incoming);

  // Accept on our side, then hand our ACCEPT back to the peer.
  await acceptIncomingOffer('bob');
  const acceptLine = sentLines.find((line) => line.includes('SIC-E2EE ACCEPT')) ?? '';
  const acceptFrame = parseCtcpFrame(bodyOf(acceptLine));
  if (acceptFrame?.type !== 'accept') {
    throw new Error('expected an accept frame');
  }
  await peer.handleHandshakeFrame('me', acceptFrame, 'notice');

  return peer;
};
