import { describe, it, expect } from 'vitest';

import {
  BodyKind,
  buildAcceptFrame,
  buildCipherFrames,
  buildDeclineFrame,
  buildOfferFrame,
  buildResetFrame,
  createReassembler,
  decodeBody,
  encodeBody,
  FRAME_TTL_MS,
  MAX_PARTS,
  newFrameId,
  parseCtcpFrame,
  type E2eeFrame,
} from '../protocol';

type CipherFrame = Extract<E2eeFrame, { type: 'cipher' }>;

const cipherFrames = (payload: string, frameId = 'abcd1234'): CipherFrame[] =>
  buildCipherFrames(payload, frameId).map((body) => {
    const frame = parseCtcpFrame(body);
    if (frame?.type !== 'cipher') {
      throw new Error(`Expected a cipher frame, got: ${body}`);
    }
    return frame;
  });

/** Indexing is checked under `noUncheckedIndexedAccess`; fail loudly instead of asserting non-null. */
const frameAt = (frames: CipherFrame[], index: number): CipherFrame => {
  const frame = frames[index];
  if (!frame) {
    throw new Error(`Expected a frame at index ${index}, got ${frames.length} frames`);
  }
  return frame;
};

/** Valid base64 of a given length, so chunk validation is exercised realistically. */
const base64Payload = (length: number): string => 'QUJDRA'.repeat(Math.ceil(length / 6)).slice(0, length);

describe('e2ee protocol', () => {
  describe('handshake frames', () => {
    it('round-trips an offer', () => {
      const frame = parseCtcpFrame(buildOfferFrame('aWRLZXk=', 'ZXBoS2V5'));

      expect(frame).toEqual({ type: 'offer', version: '1', identityKeyB64: 'aWRLZXk=', ephemeralKeyB64: 'ZXBoS2V5' });
    });

    it('round-trips an accept', () => {
      const frame = parseCtcpFrame(buildAcceptFrame('aWRLZXk=', 'ZXBoS2V5'));

      expect(frame).toEqual({ type: 'accept', version: '1', identityKeyB64: 'aWRLZXk=', ephemeralKeyB64: 'ZXBoS2V5' });
    });

    it('round-trips decline and reset', () => {
      expect(parseCtcpFrame(buildDeclineFrame())).toEqual({ type: 'decline' });
      expect(parseCtcpFrame(buildResetFrame())).toEqual({ type: 'reset' });
    });

    it('is case-insensitive on the verb, as CTCP conventionally is', () => {
      expect(parseCtcpFrame('sic-e2ee reset')).toEqual({ type: 'reset' });
    });

    it('reports the version so a future incompatible peer can be detected', () => {
      const frame = parseCtcpFrame('SIC-E2EE OFFER 9 aWRLZXk= ZXBoS2V5');

      expect(frame).toMatchObject({ type: 'offer', version: '9' });
    });
  });

  describe('rejecting malformed input', () => {
    it.each([
      ['an unrelated CTCP', 'VERSION'],
      ['an empty body', ''],
      ['an unknown handshake verb', 'SIC-E2EE FROBNICATE 1 a b'],
      ['an offer missing the ephemeral key', 'SIC-E2EE OFFER 1 aWRLZXk='],
      ['an offer with a non-base64 key', 'SIC-E2EE OFFER 1 not!valid ZXBoS2V5'],
      ['a cipher frame missing its chunk', 'SICE abcd1234 1/2'],
      ['a cipher frame with a malformed sequence', 'SICE abcd1234 1of2 QUJD'],
      ['a cipher frame with index above total', 'SICE abcd1234 3/2 QUJD'],
      ['a cipher frame with a zero index', 'SICE abcd1234 0/2 QUJD'],
      ['a cipher frame with a zero total', 'SICE abcd1234 0/0 QUJD'],
      ['a cipher frame with a non-base64 chunk', 'SICE abcd1234 1/1 not!base64'],
      ['a cipher frame with trailing junk', 'SICE abcd1234 1/1 QUJD extra'],
      ['an offer with trailing junk', 'SIC-E2EE OFFER 1 aWRLZXk= ZXBoS2V5 extra'],
      ['a decline with trailing junk', 'SIC-E2EE DECLINE now'],
    ])('returns null for %s', (_label, input) => {
      expect(parseCtcpFrame(input)).toBeNull();
    });

    it('rejects a total above the part limit rather than allocating for it', () => {
      expect(parseCtcpFrame(`SICE abcd1234 1/${MAX_PARTS + 1} QUJD`)).toBeNull();
    });
  });

  describe('body kinds', () => {
    it('round-trips a normal message', () => {
      expect(decodeBody(encodeBody(BodyKind.message, 'hello'))).toEqual({ kind: BodyKind.message, text: 'hello' });
    });

    it('round-trips an action so /me survives encryption', () => {
      expect(decodeBody(encodeBody(BodyKind.action, 'waves'))).toEqual({ kind: BodyKind.action, text: 'waves' });
    });

    it('round-trips an empty body', () => {
      expect(decodeBody(encodeBody(BodyKind.message, ''))).toEqual({ kind: BodyKind.message, text: '' });
    });

    it('shows an unknown kind from a newer peer as a plain message rather than dropping it', () => {
      expect(decodeBody('zsomething new')).toEqual({ kind: BodyKind.message, text: 'something new' });
    });
  });

  describe('chunking', () => {
    it('sends a short message as a single frame', () => {
      const frames = buildCipherFrames('QUJDRA==', 'abcd1234');

      expect(frames).toEqual(['SICE abcd1234 1/1 QUJDRA==']);
    });

    it('keeps every line comfortably inside the IRC length limit', () => {
      const frames = buildCipherFrames(base64Payload(2000));

      for (const frame of frames) {
        // The full line is `PRIVMSG <target> :\x01<frame>\x01`, and the server
        // prepends a source prefix on relay; 400 leaves room for both.
        expect(frame.length).toBeLessThan(400);
      }
    });

    it('refuses a message too large to fit the part limit instead of sending frames that get discarded', () => {
      expect(() => buildCipherFrames(base64Payload(100_000))).toThrow(/too long/);
    });

    it('generates distinct frame ids', () => {
      const ids = new Set(Array.from({ length: 200 }, () => newFrameId()));

      expect(ids.size).toBe(200);
    });
  });

  describe('reassembly', () => {
    it('reassembles a multi-frame message', () => {
      const payload = base64Payload(1000);
      const reassembler = createReassembler();
      const frames = cipherFrames(payload);

      expect(frames.length).toBeGreaterThan(1);
      const results = frames.map((frame) => reassembler.accept('bob', frame));

      expect(results.slice(0, -1).every((result) => result === null)).toBe(true);
      expect(results.at(-1)).toBe(payload);
      expect(reassembler.size).toBe(0);
    });

    it('reassembles when chunks arrive out of order', () => {
      const payload = base64Payload(1000);
      const reassembler = createReassembler();
      const frames = cipherFrames(payload);

      const reversed = [...frames].reverse();
      const results = reversed.map((frame) => reassembler.accept('bob', frame));

      expect(results.at(-1)).toBe(payload);
    });

    it('returns a single-frame message immediately', () => {
      const reassembler = createReassembler();
      const frame = frameAt(cipherFrames('QUJDRA=='), 0);

      expect(reassembler.accept('bob', frame)).toBe('QUJDRA==');
      expect(reassembler.size).toBe(0);
    });

    it('keeps concurrent messages from the same peer separate', () => {
      const reassembler = createReassembler();
      const first = cipherFrames(base64Payload(600), 'aaaaaaaa');
      const second = cipherFrames(base64Payload(600), 'bbbbbbbb');

      expect(reassembler.accept('bob', frameAt(first, 0))).toBeNull();
      expect(reassembler.accept('bob', frameAt(second, 0))).toBeNull();
      expect(reassembler.accept('bob', frameAt(second, 1))).toBe(second.map((frame) => frame.chunk).join(''));
      expect(reassembler.accept('bob', frameAt(first, 1))).toBe(first.map((frame) => frame.chunk).join(''));
    });

    it('keeps the same frame id from different peers separate', () => {
      const reassembler = createReassembler();
      const frames = cipherFrames(base64Payload(600), 'collide0');

      expect(reassembler.accept('bob', frameAt(frames, 0))).toBeNull();
      expect(reassembler.accept('carol', frameAt(frames, 0))).toBeNull();
      expect(reassembler.size).toBe(2);
    });

    it('treats a peer name case-insensitively, as IRC does', () => {
      const reassembler = createReassembler();
      const frames = cipherFrames(base64Payload(600));

      expect(reassembler.accept('Bob', frameAt(frames, 0))).toBeNull();
      expect(reassembler.accept('bob', frameAt(frames, 1))).toBe(frames.map((frame) => frame.chunk).join(''));
    });

    it('ignores a duplicate chunk instead of completing early', () => {
      const reassembler = createReassembler();
      const frames = cipherFrames(base64Payload(600));

      expect(reassembler.accept('bob', frameAt(frames, 0))).toBeNull();
      expect(reassembler.accept('bob', frameAt(frames, 0))).toBeNull();
      expect(reassembler.accept('bob', frameAt(frames, 1))).toBe(frames.map((frame) => frame.chunk).join(''));
    });

    it('restarts when a peer contradicts the part count it already claimed', () => {
      const reassembler = createReassembler();
      const first = frameAt(cipherFrames(base64Payload(600), 'shifty01'), 0);

      expect(reassembler.accept('bob', first)).toBeNull();
      expect(reassembler.accept('bob', { type: 'cipher', frameId: 'shifty01', index: 1, total: 3, chunk: 'QUJD' })).toBeNull();
      expect(reassembler.size).toBe(1);
    });

    it('drops an incomplete message once it expires', () => {
      const reassembler = createReassembler();
      const frames = cipherFrames(base64Payload(600));
      const start = 1_000_000;

      expect(reassembler.accept('bob', frameAt(frames, 0), start)).toBeNull();
      expect(reassembler.size).toBe(1);

      // The missing chunk turns up too late; the partial message must be gone,
      // not silently completed with stale data.
      expect(reassembler.accept('bob', frameAt(frames, 1), start + FRAME_TTL_MS + 1_000)).toBeNull();
      expect(reassembler.size).toBe(1);
    });

    it('bounds memory when a peer opens messages it never finishes', () => {
      const reassembler = createReassembler();

      for (let index = 0; index < 500; index++) {
        reassembler.accept('bob', { type: 'cipher', frameId: `frame${index}`, index: 1, total: 2, chunk: 'QUJD' });
      }

      expect(reassembler.size).toBeLessThanOrEqual(64);
    });

    it('forgets a peer without disturbing the others', () => {
      const reassembler = createReassembler();
      const frames = cipherFrames(base64Payload(600));

      reassembler.accept('bob', frameAt(frames, 0));
      reassembler.accept('carol', frameAt(frames, 0));
      reassembler.forget('BOB');

      expect(reassembler.size).toBe(1);
    });
  });
});
