/**
 * SIC-E2EE v1 — wire format. CTCP rather than a message tag: other clients silently ignore unknown CTCP.
 *
 *   SIC-E2EE OFFER 1 <identityKey> <ephemeralKey>   (PRIVMSG)
 *   SIC-E2EE ACCEPT 1 <identityKey> <ephemeralKey>  (NOTICE)
 *   SIC-E2EE DECLINE                                (NOTICE)
 *   SIC-E2EE RESET                                  (NOTICE)
 *   SICE <frameId> <index>/<total> <chunk>          (PRIVMSG)
 */

/** Bumped only on an incompatible wire change; peers ignore versions they don't know. */
export const PROTOCOL_VERSION = '1';

export const HANDSHAKE_CTCP = 'SIC-E2EE';

export const CIPHER_CTCP = 'SICE';

/** Without LINELEN. The relayed line adds an unmeasurable `:nick!ident@host ` prefix; truncation loses the message. */
export const DEFAULT_CHUNK_CHARS = 320;

/** Prefix, envelope and header: a fixed cost whatever the server's line length. */
const LINE_LEN_OVERHEAD = 512 - DEFAULT_CHUNK_CHARS;

/** Never fragment below this, even if a server advertises an implausibly short line length. */
const MIN_CHUNK_CHARS = 32;

/** From ISUPPORT LINELEN; `serverLineLen` 0 = not sent. */
export const chunkCharsFor = (serverLineLen: number): number =>
  serverLineLen > 0 ? Math.max(MIN_CHUNK_CHARS, serverLineLen - LINE_LEN_OVERHEAD) : DEFAULT_CHUNK_CHARS;

/** A single message may span at most this many frames (~5 KB of ciphertext). */
export const MAX_PARTS = 16;

/** Distinct incomplete messages held per peer set, before the oldest is evicted. */
const MAX_PENDING_FRAMES = 64;

// Counted from the first chunk; flood control can stretch 16 chunks to most of a minute. Memory is bounded separately
export const FRAME_TTL_MS = 120_000;

const FRAME_ID_LENGTH = 8;

const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/** e.g. `3/16`; two digits suffice for MAX_PARTS. */
const CHUNK_SEQUENCE_PATTERN = /^(?<index>\d{1,2})\/(?<total>\d{1,2})$/;

export const BodyKind = {
  message: 'm',
  /** `/me` */
  action: 'a',
} as const;

export type BodyKind = (typeof BodyKind)[keyof typeof BodyKind];

export type E2eeFrame =
  | { type: 'offer'; version: string; identityKeyB64: string; ephemeralKeyB64: string }
  | { type: 'accept'; version: string; identityKeyB64: string; ephemeralKeyB64: string }
  | { type: 'decline' }
  | { type: 'reset' }
  | { type: 'cipher'; frameId: string; index: number; total: number; chunk: string };

export const newFrameId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(FRAME_ID_LENGTH));

  return [...bytes].map((byte) => (byte % 36).toString(36)).join('');
};

export const buildOfferFrame = (identityKeyB64: string, ephemeralKeyB64: string): string =>
  `${HANDSHAKE_CTCP} OFFER ${PROTOCOL_VERSION} ${identityKeyB64} ${ephemeralKeyB64}`;

export const buildAcceptFrame = (identityKeyB64: string, ephemeralKeyB64: string): string =>
  `${HANDSHAKE_CTCP} ACCEPT ${PROTOCOL_VERSION} ${identityKeyB64} ${ephemeralKeyB64}`;

export const buildDeclineFrame = (): string => `${HANDSHAKE_CTCP} DECLINE`;

export const buildResetFrame = (): string => `${HANDSHAKE_CTCP} RESET`;

/** Throws when too large rather than emitting frames the peer would discard. */
export const buildCipherFrames = (sealedB64: string, frameId = newFrameId(), chunkChars = DEFAULT_CHUNK_CHARS): string[] => {
  const chunks: string[] = [];
  for (let offset = 0; offset < sealedB64.length; offset += chunkChars) {
    chunks.push(sealedB64.slice(offset, offset + chunkChars));
  }
  if (chunks.length === 0) {
    chunks.push('');
  }

  if (chunks.length > MAX_PARTS) {
    throw new Error(`Message is too long to encrypt: needs ${chunks.length} frames, limit is ${MAX_PARTS}`);
  }

  return chunks.map((chunk, position) => `${CIPHER_CTCP} ${frameId} ${position + 1}/${chunks.length} ${chunk}`);
};

export const encodeBody = (kind: BodyKind, text: string): string => `${kind}${text}`;

export const decodeBody = (plaintext: string): { kind: BodyKind; text: string } => {
  const marker = plaintext.slice(0, 1);
  const kind: BodyKind = marker === BodyKind.action ? BodyKind.action : BodyKind.message;

  // Unknown kind from a newer peer: still show the text
  return { kind, text: plaintext.slice(1) };
};

const parseHandshake = (params: string[]): E2eeFrame | null => {
  const verb = params[0]?.toUpperCase();

  if (verb === 'DECLINE') {
    return params.length === 1 ? { type: 'decline' } : null;
  }
  if (verb === 'RESET') {
    return params.length === 1 ? { type: 'reset' } : null;
  }
  // Exact arity: extra tokens are corruption or probing
  if ((verb !== 'OFFER' && verb !== 'ACCEPT') || params.length !== 4) {
    return null;
  }

  const version = params[1];
  const identityKeyB64 = params[2];
  const ephemeralKeyB64 = params[3];
  if (version === undefined || identityKeyB64 === undefined || ephemeralKeyB64 === undefined) {
    return null;
  }
  if (!BASE64_PATTERN.test(identityKeyB64) || !BASE64_PATTERN.test(ephemeralKeyB64)) {
    return null;
  }

  return verb === 'OFFER'
    ? { type: 'offer', version, identityKeyB64, ephemeralKeyB64 }
    : { type: 'accept', version, identityKeyB64, ephemeralKeyB64 };
};

/** `params` = [frameId, "<index>/<total>", chunk] */
const parseCipher = (params: string[]): E2eeFrame | null => {
  if (params.length !== 3) {
    return null;
  }
  const [frameId, chunkSequence, chunk] = params;
  if (frameId === undefined || chunkSequence === undefined || chunk === undefined) {
    return null;
  }

  const sequence = CHUNK_SEQUENCE_PATTERN.exec(chunkSequence);
  if (!sequence?.groups) {
    return null;
  }

  const index = Number(sequence.groups.index);
  const total = Number(sequence.groups.total);
  if (total < 1 || total > MAX_PARTS || index < 1 || index > total) {
    return null;
  }
  if (!BASE64_PATTERN.test(chunk)) {
    return null;
  }

  return { type: 'cipher', frameId, index, total, chunk };
};

/** Null for anything malformed, treated as "not ours" by callers. */
export const parseCtcpFrame = (ctcpContent: string): E2eeFrame | null => {
  const parts = ctcpContent.split(' ').filter((part) => part.length > 0);
  const verb = parts[0]?.toUpperCase();

  if (verb === HANDSHAKE_CTCP) {
    return parseHandshake(parts.slice(1));
  }
  if (verb === CIPHER_CTCP) {
    return parseCipher(parts.slice(1));
  }

  return null;
};

interface PendingFrame {
  parts: (string | undefined)[];
  total: number;
  received: number;
  expiresAt: number;
}

export interface Reassembler {
  /** The full payload once the last chunk arrives (any order), else null. */
  accept: (peer: string, frame: Extract<E2eeFrame, { type: 'cipher' }>, now?: number) => string | null;
  forget: (peer: string) => void;
  clear: () => void;
  /** For tests. */
  readonly size: number;
}

/** Bounded and expiring, so a peer can't pin memory with never-finished frames. */
export const createReassembler = (): Reassembler => {
  // Keyed by peer too, so equal random frameIds from two peers can't collide
  const pending = new Map<string, PendingFrame>();

  const evictExpired = (now: number): void => {
    for (const [key, frame] of pending) {
      if (frame.expiresAt <= now) {
        pending.delete(key);
      }
    }
  };

  return {
    accept(peer, frame, now = Date.now()) {
      evictExpired(now);

      const key = `${peer.toLowerCase()} ${frame.frameId}`;
      let entry = pending.get(key);

      // Resent or forged: start over rather than mix the two
      if (entry && entry.total !== frame.total) {
        pending.delete(key);
        entry = undefined;
      }

      if (frame.total === 1) {
        pending.delete(key);
        return frame.chunk;
      }

      if (!entry) {
        if (pending.size >= MAX_PENDING_FRAMES) {
          const oldest = [...pending.entries()].reduce((min, current) =>
            current[1].expiresAt < min[1].expiresAt ? current : min,
          );
          pending.delete(oldest[0]);
        }
        entry = { parts: Array.from({ length: frame.total }), total: frame.total, received: 0, expiresAt: now + FRAME_TTL_MS };
        pending.set(key, entry);
      }

      if (entry.parts[frame.index - 1] !== undefined) {
        return null;
      }

      entry.parts[frame.index - 1] = frame.chunk;
      entry.received += 1;

      if (entry.received < entry.total) {
        return null;
      }

      pending.delete(key);

      return entry.parts.join('');
    },

    forget(peer) {
      const prefix = `${peer.toLowerCase()} `;
      for (const key of pending.keys()) {
        if (key.startsWith(prefix)) {
          pending.delete(key);
        }
      }
    },

    clear() {
      pending.clear();
    },

    get size() {
      return pending.size;
    },
  };
};
