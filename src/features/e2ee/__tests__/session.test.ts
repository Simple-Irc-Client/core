/**
 * Two-client integration test for the handshake.
 *
 * `session.ts` keeps key material in module-level state, so a second peer means
 * a genuinely separate module instance: `vi.resetModules()` plus `vi.doMock()`
 * gives each client its own copy with its own mocked wire. The two halves then
 * talk to each other through a fake IRC server, which is the only way to check
 * that the roles, the pinning and the directional keys actually line up rather
 * than merely agreeing with themselves.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { BodyKind } from '../protocol';
import { E2eeState } from '../store/e2ee';

type SessionModule = typeof import('../session');
type StoreModule = typeof import('../store/e2ee');
type PinsModule = typeof import('../store/pins');

interface Client {
  nick: string;
  session: SessionModule;
  store: StoreModule;
  pins: PinsModule;
}

/** Lines a client handed to `ircSendRawMessage`, in order. */
const sent = new Map<string, string[]>();

/** Shared IndexedDB stand-in; identities are namespaced by network so clients don't collide. */
const idb = new Map<string, unknown>();

/** Toggles the auto-accept setting for the clients created after it is set. */
const autoOffer = { enabled: false };

/** Accounts the users store reports, so account-anchored pinning can be exercised. */
const accounts = new Map<string, string>();

const createClient = async (nick: string, network = `${nick}-net`): Promise<Client> => {
  sent.set(nick, []);

  vi.resetModules();

  vi.doMock('@/network/irc/network', () => ({
    ircSendRawMessage: (line: string): void => {
      sent.get(nick)?.push(line);
    },
  }));

  vi.doMock('@/features/settings/store/settings', () => ({
    getServer: (): { network: string } => ({ network }),
    getCaseMapping: (): string => 'ascii',
    getAutoOfferEncryption: (): boolean => autoOffer.enabled,
    getCurrentNick: (): string => nick,
  }));

  vi.doMock('@/features/users/store/users', () => ({
    getUser: (name: string): { account: string } | undefined => {
      const account = accounts.get(name.toLowerCase());
      return account === undefined ? undefined : { account };
    },
  }));

  vi.doMock('idb-keyval', () => ({
    get: async (key: string): Promise<unknown> => idb.get(key),
    set: async (key: string, value: unknown): Promise<void> => {
      idb.set(key, value);
    },
    del: async (key: string): Promise<void> => {
      idb.delete(key);
    },
  }));

  return {
    nick,
    session: await import('../session'),
    store: await import('../store/e2ee'),
    pins: await import('../store/pins'),
  };
};

const CTCP = '\x01';

interface WireLine {
  verb: 'PRIVMSG' | 'NOTICE';
  target: string;
  body: string;
}

/** Parse the CTCP lines a client emitted, ignoring anything that isn't one. */
const drain = (client: Client): WireLine[] => {
  const lines = sent.get(client.nick) ?? [];
  sent.set(client.nick, []);

  return lines.flatMap((line) => {
    const header = /^(PRIVMSG|NOTICE) (\S+) :/.exec(line);
    const start = line.indexOf(CTCP);
    const end = line.lastIndexOf(CTCP);
    if (!header || start === -1 || end <= start) {
      return [];
    }
    return [{ verb: header[1] as 'PRIVMSG' | 'NOTICE', target: header[2] ?? '', body: line.slice(start + 1, end) }];
  });
};

/** Deliver everything `from` has queued into `to`, as the IRC server would. */
const deliver = async (from: Client, to: Client): Promise<WireLine[]> => {
  const lines = drain(from);

  for (const line of lines) {
    const frame = (await import('../protocol')).parseCtcpFrame(line.body);
    if (frame === null || frame.type === 'cipher') {
      continue;
    }
    await to.session.handleHandshakeFrame(from.nick, frame, line.verb === 'PRIVMSG' ? 'privmsg' : 'notice');
  }

  return lines;
};

/** Run a full offer/accept exchange and leave both sides active. */
const completeHandshake = async (initiator: Client, responder: Client): Promise<void> => {
  await initiator.session.offerEncryption(responder.nick);
  await deliver(initiator, responder);
  await responder.session.acceptIncomingOffer(initiator.nick);
  await deliver(responder, initiator);
};

/** Send one encrypted message and return what the receiver decrypts. */
const sendAndReceive = async (
  from: Client,
  to: Client,
  text: string,
  kind: BodyKind = BodyKind.message,
): Promise<{ kind: BodyKind; text: string }> => {
  const { parseCtcpFrame } = await import('../protocol');

  await from.session.sendEncrypted(to.nick, text, kind);

  let received: { kind: BodyKind; text: string } | undefined;
  for (const line of drain(from)) {
    const frame = parseCtcpFrame(line.body);
    if (frame?.type !== 'cipher') {
      continue;
    }
    const result = to.session.acceptCipherChunk(from.nick, frame);
    if (result.status === 'complete') {
      received = await to.session.decryptSealed(from.nick, result.sealed);
    }
  }

  if (!received) {
    throw new Error('Message never completed reassembly');
  }

  return received;
};

describe('e2ee session', () => {
  beforeEach(() => {
    sent.clear();
    idb.clear();
    accounts.clear();
    autoOffer.enabled = false;
    localStorage.clear();
  });

  afterEach(() => {
    vi.doUnmock('@/network/irc/network');
    vi.doUnmock('@/features/settings/store/settings');
    vi.doUnmock('@/features/users/store/users');
    vi.doUnmock('idb-keyval');
    vi.useRealTimers();
  });

  describe('handshake', () => {
    it('takes both sides to active and lets them exchange messages', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);

      expect(alice.store.getSessionState('bob')).toBe(E2eeState.active);
      expect(bob.store.getSessionState('alice')).toBe(E2eeState.active);

      expect(await sendAndReceive(alice, bob, 'meet me at six')).toEqual({
        kind: BodyKind.message,
        text: 'meet me at six',
      });
      expect(await sendAndReceive(bob, alice, 'understood')).toEqual({
        kind: BodyKind.message,
        text: 'understood',
      });
    });

    it('shows each side the other real fingerprint', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);

      const aliceView = alice.store.getSession('bob');
      const bobView = bob.store.getSession('alice');

      expect(aliceView?.theirFingerprint).toBe(bobView?.myFingerprint);
      expect(bobView?.theirFingerprint).toBe(aliceView?.myFingerprint);
      expect(aliceView?.myFingerprint).not.toBe(aliceView?.theirFingerprint);
    });

    it('sends the offer as a PRIVMSG CTCP and the accept as a NOTICE CTCP', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await alice.session.offerEncryption('bob');
      const offer = drain(alice);

      expect(offer).toHaveLength(1);
      expect(offer[0]).toMatchObject({ verb: 'PRIVMSG', target: 'bob' });
      expect(offer[0]?.body.startsWith('SIC-E2EE OFFER 1 ')).toBe(true);

      const { parseCtcpFrame } = await import('../protocol');
      const frame = parseCtcpFrame(offer[0]?.body ?? '');
      if (frame?.type !== 'offer') {
        throw new Error('expected an offer frame');
      }
      await bob.session.handleHandshakeFrame('alice', frame, 'privmsg');
      await bob.session.acceptIncomingOffer('alice');

      const accept = drain(bob);
      expect(accept[0]).toMatchObject({ verb: 'NOTICE', target: 'alice' });
      expect(accept[0]?.body.startsWith('SIC-E2EE ACCEPT 1 ')).toBe(true);
    });

    it('parks an inbound offer in `incoming` until the user acts on it', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await alice.session.offerEncryption('bob');
      await deliver(alice, bob);

      expect(bob.store.getSessionState('alice')).toBe(E2eeState.incoming);
      // Nothing sent back yet — accepting is the user's decision, not automatic.
      expect(drain(bob)).toHaveLength(0);
      expect(alice.store.getSessionState('bob')).toBe(E2eeState.offered);
    });

    it('carries a decline back to the initiator', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await alice.session.offerEncryption('bob');
      await deliver(alice, bob);
      bob.session.declineIncomingOffer('alice');
      await deliver(bob, alice);

      expect(alice.store.getSessionState('bob')).toBe(E2eeState.declined);
      expect(bob.store.getSession('alice')).toBeUndefined();
    });

    it('ignores an ACCEPT that answers no offer of ours', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');
      const mallory = await createClient('mallory');

      // Mallory replays a well-formed ACCEPT at Alice, who never offered.
      await bob.session.offerEncryption('mallory');
      await deliver(bob, mallory);
      await mallory.session.acceptIncomingOffer('bob');
      const [accept] = drain(mallory);

      const { parseCtcpFrame } = await import('../protocol');
      const frame = parseCtcpFrame(accept?.body ?? '');
      if (frame?.type !== 'accept') {
        throw new Error('expected an accept frame');
      }
      await alice.session.handleHandshakeFrame('mallory', frame, 'notice');

      expect(alice.store.getSessionState('mallory')).toBe(E2eeState.none);
    });

    it('rejects an offer arriving over the wrong verb', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await alice.session.offerEncryption('bob');
      const [offer] = drain(alice);
      const { parseCtcpFrame } = await import('../protocol');
      const frame = parseCtcpFrame(offer?.body ?? '');
      if (frame?.type !== 'offer') {
        throw new Error('expected an offer frame');
      }

      // An OFFER is a PRIVMSG by protocol; the same frame as a NOTICE must not drive state.
      await bob.session.handleHandshakeFrame('alice', frame, 'notice');

      expect(bob.store.getSessionState('alice')).toBe(E2eeState.none);
    });

    it('errors out when the peer speaks a version we do not', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await alice.session.offerEncryption('bob');
      const [offer] = drain(alice);
      const body = (offer?.body ?? '').replace('OFFER 1 ', 'OFFER 99 ');
      const { parseCtcpFrame } = await import('../protocol');
      const frame = parseCtcpFrame(body);
      if (frame?.type !== 'offer') {
        throw new Error('expected an offer frame');
      }

      await bob.session.handleHandshakeFrame('alice', frame, 'privmsg');

      expect(bob.store.getSessionState('alice')).toBe(E2eeState.error);
    });

    it('gives up when the peer is not a SIC client and never answers', async () => {
      vi.useFakeTimers();
      const alice = await createClient('alice');

      await alice.session.offerEncryption('hexchatuser');
      expect(alice.store.getSessionState('hexchatuser')).toBe(E2eeState.offered);

      await vi.advanceTimersByTimeAsync(61_000);

      expect(alice.store.getSessionState('hexchatuser')).toBe(E2eeState.error);
    });

    it('lets a late accept win when it arrives just before the timeout fires', async () => {
      vi.useFakeTimers();
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);
      await vi.advanceTimersByTimeAsync(61_000);

      expect(alice.store.getSessionState('bob')).toBe(E2eeState.active);
    });

    it('still completes the handshake from an accept that arrives after the wait already timed out', async () => {
      // A slow link or a peer who took a moment to click Accept: our own wait
      // gives up and shows an error before their reply is actually delivered.
      // The keys must not have been thrown away for this to still work.
      vi.useFakeTimers();
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await alice.session.offerEncryption('bob');
      await deliver(alice, bob);

      await vi.advanceTimersByTimeAsync(61_000);
      expect(alice.store.getSessionState('bob')).toBe(E2eeState.error);

      await bob.session.acceptIncomingOffer('alice');
      await deliver(bob, alice);

      expect(alice.store.getSessionState('bob')).toBe(E2eeState.active);
      expect(await sendAndReceive(alice, bob, 'hello after the timeout')).toEqual({
        kind: BodyKind.message,
        text: 'hello after the timeout',
      });
    });

    it('does not resurrect a timed-out offer once the user has cancelled it', async () => {
      vi.useFakeTimers();
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await alice.session.offerEncryption('bob');
      await deliver(alice, bob);
      await vi.advanceTimersByTimeAsync(61_000);
      expect(alice.store.getSessionState('bob')).toBe(E2eeState.error);

      alice.session.endSession('bob', false);

      await bob.session.acceptIncomingOffer('alice');
      await deliver(bob, alice);

      expect(alice.store.getSessionState('bob')).toBe(E2eeState.none);
    });
  });

  describe('re-handshaking', () => {
    it('resolves simultaneous offers into one session both sides can use', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      // Neither has seen the other's offer yet — this is the glare case.
      await alice.session.offerEncryption('bob');
      await bob.session.offerEncryption('alice');

      await deliver(alice, bob);
      await deliver(bob, alice);
      await deliver(bob, alice);

      expect(alice.store.getSessionState('bob')).toBe(E2eeState.active);
      expect(bob.store.getSessionState('alice')).toBe(E2eeState.active);

      // The real failure this guards against was two "active" sessions built
      // from different ephemeral pairs: both padlocks on, nothing decryptable.
      expect(await sendAndReceive(alice, bob, 'glare survived')).toEqual({
        kind: BodyKind.message,
        text: 'glare survived',
      });
      expect(await sendAndReceive(bob, alice, 'both directions')).toEqual({
        kind: BodyKind.message,
        text: 'both directions',
      });
    });

    it('settles glare the same way regardless of which side is asked first', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await alice.session.offerEncryption('bob');
      await bob.session.offerEncryption('alice');

      // Deliver in the opposite order to the previous test.
      await deliver(bob, alice);
      await deliver(alice, bob);
      await deliver(bob, alice);

      expect(alice.store.getSessionState('bob')).toBe(E2eeState.active);
      expect(bob.store.getSessionState('alice')).toBe(E2eeState.active);
      expect(await sendAndReceive(alice, bob, 'still fine')).toEqual({
        kind: BodyKind.message,
        text: 'still fine',
      });
    });

    // Characterisation, not a regression guard: the store and the key material
    // already moved together here. Pinned so a future change to the re-offer
    // path cannot let the window keep a padlock it can no longer back.
    it('does not keep claiming an active session when the peer offers again', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);
      expect(alice.store.getSessionState('bob')).toBe(E2eeState.active);

      // Bob restarts and asks to start over; Alice still holds the old session.
      bob.session.endAllSessions();
      await bob.session.offerEncryption('alice');
      await deliver(bob, alice);

      // The store and the key material must agree. Previously the offer
      // overwrote the keys while the store still read `active`, so the window
      // kept its padlock and every send threw.
      expect(alice.store.getSessionState('bob')).toBe(E2eeState.incoming);
      await expect(alice.session.sendEncrypted('bob', 'no session', BodyKind.message)).rejects.toThrow();
    });

    it('recovers to a working session after the peer re-offers', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);
      bob.session.endAllSessions();
      await bob.session.offerEncryption('alice');
      await deliver(bob, alice);

      await alice.session.acceptIncomingOffer('bob');
      await deliver(alice, bob);

      expect(alice.store.getSessionState('bob')).toBe(E2eeState.active);
      expect(await sendAndReceive(alice, bob, 'recovered')).toEqual({
        kind: BodyKind.message,
        text: 'recovered',
      });
    });

    it('still refuses a re-offer carrying a different identity key', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);

      // Someone else answers to `bob` and offers to start over.
      const impostor = await createClient('bob', 'impostor-net');
      await impostor.session.offerEncryption('alice');
      const [offer] = drain(impostor);
      const { parseCtcpFrame } = await import('../protocol');
      const frame = parseCtcpFrame(offer?.body ?? '');
      if (frame?.type !== 'offer') {
        throw new Error('expected an offer frame');
      }
      await alice.session.handleHandshakeFrame('bob', frame, 'privmsg');

      expect(alice.store.getSessionState('bob')).toBe(E2eeState.fingerprintChanged);
    });
  });

  describe('pinning', () => {
    it('pins the peer identity on first contact', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);

      const pin = alice.pins.getPin('alice-net', 'nick:bob');
      expect(pin?.fingerprint).toBe(bob.store.getSession('alice')?.myFingerprint);
      expect(pin?.verified).toBe(false);
    });

    it('anchors the pin to a services account when the peer has one', async () => {
      accounts.set('bob', 'BobAccount');
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);

      expect(alice.pins.getPin('alice-net', 'account:bobaccount')).toBeDefined();
      expect(alice.pins.getPin('alice-net', 'nick:bob')).toBeUndefined();
    });

    it('blocks instead of re-keying when the identity behind a nick changes', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);
      const realFingerprint = alice.store.getSession('bob')?.theirFingerprint;
      alice.session.endSession('bob', false);
      drain(alice);

      // Someone else now holds the nick `bob` — a different identity key.
      const impostor = await createClient('bob', 'impostor-net');
      await impostor.session.offerEncryption('alice');
      const [offer] = drain(impostor);
      const { parseCtcpFrame } = await import('../protocol');
      const frame = parseCtcpFrame(offer?.body ?? '');
      if (frame?.type !== 'offer') {
        throw new Error('expected an offer frame');
      }
      await alice.session.handleHandshakeFrame('bob', frame, 'privmsg');

      const session = alice.store.getSession('bob');
      expect(session?.state).toBe(E2eeState.fingerprintChanged);
      expect(session?.expectedFingerprint).toBe(realFingerprint);
      expect(session?.theirFingerprint).not.toBe(realFingerprint);
    });

    it('accepts the same peer again without re-prompting about the fingerprint', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);
      alice.session.endSession('bob', false);
      bob.session.endSession('alice', false);
      drain(alice);
      drain(bob);

      await completeHandshake(alice, bob);

      expect(alice.store.getSessionState('bob')).toBe(E2eeState.active);
    });

    it('remembers that the user verified a fingerprint out of band', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);
      alice.session.markVerified('bob', true);

      expect(alice.store.getSession('bob')?.verified).toBe(true);
      expect(alice.pins.getPin('alice-net', 'nick:bob')?.verified).toBe(true);

      alice.session.endSession('bob', false);
      bob.session.endSession('alice', false);
      drain(alice);
      drain(bob);
      await completeHandshake(alice, bob);

      expect(alice.store.getSession('bob')?.verified).toBe(true);
    });
  });

  describe('plaintext downgrade warning', () => {
    it('stays quiet for a peer we have never encrypted with', async () => {
      const alice = await createClient('alice');

      expect(alice.session.hasPinnedPeer('stranger')).toBe(false);
      expect(alice.session.shouldWarnPlaintext('stranger')).toBe(false);
    });

    it('warns once a peer has been pinned and the conversation is in the clear', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);
      expect(alice.session.shouldWarnPlaintext('bob')).toBe(false);

      // An injected RESET is exactly how an attacker forces plaintext.
      const { parseCtcpFrame } = await import('../protocol');
      const reset = parseCtcpFrame('SIC-E2EE RESET');
      if (reset?.type !== 'reset') {
        throw new Error('expected a reset frame');
      }
      await alice.session.handleHandshakeFrame('bob', reset, 'notice');

      expect(alice.store.getSessionState('bob')).toBe(E2eeState.none);
      expect(alice.session.shouldWarnPlaintext('bob')).toBe(true);
    });

    it('warns when a handshake never happens at all, which is the silent case', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);
      alice.session.endAllSessions();

      // Fresh connection, pin survives, no session was ever established because
      // the offers were dropped in transit.
      expect(alice.session.shouldWarnPlaintext('bob')).toBe(true);
    });

    it('stops warning once the user accepts the plaintext conversation', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);
      alice.session.endSession('bob', false);
      expect(alice.session.shouldWarnPlaintext('bob')).toBe(true);

      alice.session.acknowledgePlaintext('bob');

      expect(alice.session.shouldWarnPlaintext('bob')).toBe(false);
    });

    it('warns again after encryption comes back and is lost a second time', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);
      alice.session.endSession('bob', false);
      alice.session.acknowledgePlaintext('bob');
      expect(alice.session.shouldWarnPlaintext('bob')).toBe(false);

      // Re-encrypting spends the acknowledgement: a later loss is news again.
      bob.session.endAllSessions();
      drain(alice);
      drain(bob);
      await completeHandshake(alice, bob);
      alice.session.endSession('bob', false);

      expect(alice.session.shouldWarnPlaintext('bob')).toBe(true);
    });

    it('does not warn while a handshake is in progress or already flagged', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);
      alice.session.endSession('bob', false);
      drain(alice);

      // Offering again puts a more specific banner on screen; this one defers.
      await alice.session.offerEncryption('bob');
      expect(alice.store.getSessionState('bob')).toBe(E2eeState.offered);
      expect(alice.session.shouldWarnPlaintext('bob')).toBe(false);
    });

    it('forgets acknowledgements on disconnect', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);
      alice.session.endSession('bob', false);
      alice.session.acknowledgePlaintext('bob');

      alice.session.endAllSessions();

      // A new connection is a new conversation; the pin outlives it, the
      // "plaintext is fine here" decision does not.
      expect(alice.session.shouldWarnPlaintext('bob')).toBe(true);
    });

    it('keys the warning per peer', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);
      alice.session.endSession('bob', false);
      alice.session.acknowledgePlaintext('bob');

      expect(alice.session.shouldWarnPlaintext('bob')).toBe(false);
      expect(alice.session.shouldWarnPlaintext('carol')).toBe(false);
      expect(alice.session.hasPinnedPeer('bob')).toBe(true);
    });
  });

  describe('messaging', () => {
    it('round-trips an action so /me stays encrypted', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);

      expect(await sendAndReceive(alice, bob, 'waves', BodyKind.action)).toEqual({
        kind: BodyKind.action,
        text: 'waves',
      });
    });

    it('splits a long message across frames and reassembles it', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');
      const long = 'żółć '.repeat(150);

      await completeHandshake(alice, bob);

      // Confirm it really is multi-frame before asserting the round trip, so this
      // keeps testing reassembly rather than quietly becoming a single-frame case.
      await alice.session.sendEncrypted('bob', long, BodyKind.message);
      expect(drain(alice).length).toBeGreaterThan(1);

      expect(await sendAndReceive(alice, bob, long)).toEqual({ kind: BodyKind.message, text: long });
    });

    it('never puts the plaintext on the wire', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);
      await alice.session.sendEncrypted('bob', 'the password is hunter2', BodyKind.message);

      for (const line of sent.get('alice') ?? []) {
        expect(line).not.toContain('hunter2');
      }
    });

    it('refuses to send when there is no session, rather than falling back to plaintext', async () => {
      const alice = await createClient('alice');

      await expect(alice.session.sendEncrypted('bob', 'secret', BodyKind.message)).rejects.toThrow(/No active/);
    });

    it('reports a cipher frame from a peer we have no session with', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);
      await alice.session.sendEncrypted('bob', 'hello', BodyKind.message);
      const [line] = drain(alice);

      const { parseCtcpFrame } = await import('../protocol');
      const frame = parseCtcpFrame(line?.body ?? '');
      if (frame?.type !== 'cipher') {
        throw new Error('expected a cipher frame');
      }

      bob.session.endSession('alice', false);
      expect(bob.session.acceptCipherChunk('alice', frame).status).toBe('noSession');
    });

    it('drops our own frames echoed back by the server', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);
      await alice.session.sendEncrypted('bob', 'hello', BodyKind.message);
      const [line] = drain(alice);

      const { parseCtcpFrame } = await import('../protocol');
      const frame = parseCtcpFrame(line?.body ?? '');
      if (frame?.type !== 'cipher') {
        throw new Error('expected a cipher frame');
      }

      // With echo-message the server hands the frame straight back to us.
      expect(alice.session.acceptCipherChunk('bob', frame).status).toBe('echo');
    });

    it('fails to decrypt a tampered frame instead of showing altered text', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);
      await alice.session.sendEncrypted('bob', 'transfer 100', BodyKind.message);
      const [line] = drain(alice);

      const { parseCtcpFrame } = await import('../protocol');
      const frame = parseCtcpFrame(line?.body ?? '');
      if (frame?.type !== 'cipher') {
        throw new Error('expected a cipher frame');
      }

      const tampered = { ...frame, chunk: `${frame.chunk.slice(0, -4)}AAAA` };
      const result = bob.session.acceptCipherChunk('alice', tampered);
      if (result.status !== 'complete') {
        throw new Error('expected reassembly to complete');
      }

      await expect(bob.session.decryptSealed('alice', result.sealed)).rejects.toThrow();
    });
  });

  describe('teardown', () => {
    it('tells the peer when a session ends', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);
      drain(alice);
      alice.session.endSession('bob');

      const lines = drain(alice);
      expect(lines[0]).toMatchObject({ verb: 'NOTICE', target: 'bob', body: 'SIC-E2EE RESET' });
      expect(alice.store.getSession('bob')).toBeUndefined();
    });

    it('closes the session on the far side when a RESET arrives', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);
      drain(bob);
      alice.session.endSession('bob');
      await deliver(alice, bob);

      expect(bob.store.getSession('alice')).toBeUndefined();
    });

    it('drops the session when the peer renames rather than following the new nick', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);
      alice.session.handlePeerRename('bob', 'bob_away');

      expect(alice.store.getSession('bob')).toBeUndefined();
      expect(alice.store.getSessionState('bob_away')).toBe(E2eeState.error);
      await expect(alice.session.sendEncrypted('bob_away', 'still safe?', BodyKind.message)).rejects.toThrow();
    });

    it('clears everything on disconnect', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);
      alice.session.endAllSessions();

      expect(alice.store.getSession('bob')).toBeUndefined();
      await expect(alice.session.sendEncrypted('bob', 'hello', BodyKind.message)).rejects.toThrow();
    });

    it('treats nicks case-insensitively, as IRC does', async () => {
      const alice = await createClient('alice');
      const bob = await createClient('bob');

      await completeHandshake(alice, bob);

      expect(alice.store.isSessionActive('BOB')).toBe(true);
      expect(await sendAndReceive(alice, bob, 'case folds')).toEqual({
        kind: BodyKind.message,
        text: 'case folds',
      });
    });
  });
});
