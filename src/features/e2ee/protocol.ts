/**
 * SIC-E2EE v1 — wire format.
 *
 * Everything travels as CTCP. `Kernel.handleCtcp` ends in
 * `default: // Unknown CTCP, ignore silently`, and virtually every other IRC
 * client does the same, so a peer running HexChat or irssi sees nothing at all
 * when we send these — no stray text, no error. That is the whole reason for
 * choosing CTCP over, say, a message tag: it degrades to silence.
 *
 * Two CTCP verbs:
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

/**
 * Base64 characters per chunk.
 *
 * The IRC line limit is 512 including CRLF, but what has to fit is the line the
 * *server* relays, which is our line plus a `:nick!ident@host ` prefix we don't
 * control and can't measure — a long cloak runs to ~100 characters. Add the
 * `PRIVMSG <target> :` envelope and the frame header, and 320 leaves comfortable
 * margin. Getting this wrong is not a cosmetic bug: a truncated chunk makes the
 * reassembled ciphertext fail GCM authentication and the message is lost.
 */
const MAX_CHUNK_CHARS = 320;

/** A single message may span at most this many frames (~5 KB of ciphertext). */
export const MAX_PARTS = 16;

/** Distinct incomplete messages held per peer set, before the oldest is evicted. */
const MAX_PENDING_FRAMES = 64;

/** How long an incomplete message waits for its missing chunks. */
const FRAME_TTL_MS = 30_000;

const FRAME_ID_LENGTH = 8;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/** Message kinds carried inside the encrypted body. */
export const BodyKind = {
  /** An ordinary PRIVMSG body. */
  message: 'm',
  /** A CTCP ACTION body — `/me`. */
  action: 'a',
} as const;

export type BodyKind = (typeof BodyKind)[keyof typeof BodyKind];

export type E2eeFrame =
  | { type: 'offer'; version: string; identityKeyB64: string; ephemeralKeyB64: string }
  | { type: 'accept'; version: string; identityKeyB64: string; ephemeralKeyB64: string }
  | { type: 'decline' }
  | { type: 'reset' }
  | { type: 'cipher'; frameId: string; index: number; total: number; chunk: string };

/** Random, collision-resistant enough to tell concurrent messages apart within a 30 s window. */
export const newFrameId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(FRAME_ID_LENGTH));

  return [...bytes].map((byte) => (byte % 36).toString(36)).join('');
};

// --- Building ---

export const buildOfferFrame = (identityKeyB64: string, ephemeralKeyB64: string): string =>
  `${HANDSHAKE_CTCP} OFFER ${PROTOCOL_VERSION} ${identityKeyB64} ${ephemeralKeyB64}`;

export const buildAcceptFrame = (identityKeyB64: string, ephemeralKeyB64: string): string =>
  `${HANDSHAKE_CTCP} ACCEPT ${PROTOCOL_VERSION} ${identityKeyB64} ${ephemeralKeyB64}`;

export const buildDeclineFrame = (): string => `${HANDSHAKE_CTCP} DECLINE`;

export const buildResetFrame = (): string => `${HANDSHAKE_CTCP} RESET`;

/**
 * Split a sealed payload into one or more CTCP bodies.
 *
 * Throws if the message is too large to send, rather than emitting frames the
 * peer will discard — the caller surfaces that to the user as a failed send.
 */
export const buildCipherFrames = (sealedB64: string, frameId = newFrameId()): string[] => {
  const chunks: string[] = [];
  for (let offset = 0; offset < sealedB64.length; offset += MAX_CHUNK_CHARS) {
    chunks.push(sealedB64.slice(offset, offset + MAX_CHUNK_CHARS));
  }
  if (chunks.length === 0) {
    chunks.push('');
  }

  if (chunks.length > MAX_PARTS) {
    throw new Error(`Message is too long to encrypt: needs ${chunks.length} frames, limit is ${MAX_PARTS}`);
  }

  return chunks.map((chunk, index) => `${CIPHER_CTCP} ${frameId} ${index + 1}/${chunks.length} ${chunk}`);
};

/** Wrap a message body with its kind, so `/me` survives the round trip. */
export const encodeBody = (kind: BodyKind, text: string): string => `${kind}${text}`;

export const decodeBody = (plaintext: string): { kind: BodyKind; text: string } => {
  const marker = plaintext.slice(0, 1);
  const kind: BodyKind = marker === BodyKind.action ? BodyKind.action : BodyKind.message;

  // An unrecognised marker means a newer peer sent a kind we don't handle. Show
  // the body as a plain message rather than dropping it — the text is still real.
  return { kind, text: plaintext.slice(1) };
};

// --- Parsing ---

const parseHandshake = (params: string[]): E2eeFrame | null => {
  const verb = params[0]?.toUpperCase();

  if (verb === 'DECLINE') {
    return params.length === 1 ? { type: 'decline' } : null;
  }
  if (verb === 'RESET') {
    return params.length === 1 ? { type: 'reset' } : null;
  }
  // Exact arity, not "at least": a frame carrying unexpected trailing tokens is
  // not something this version produces, so it is either corruption or someone
  // probing the parser. Either way it should not reach the state machine.
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

const parseCipher = (params: string[]): E2eeFrame | null => {
  if (params.length !== 3) {
    return null;
  }
  const frameId = params[0];
  const sequence = params[1];
  const chunk = params[2];
  if (frameId === undefined || sequence === undefined || chunk === undefined) {
    return null;
  }

  const match = /^(\d{1,2})\/(\d{1,2})$/.exec(sequence);
  if (!match) {
    return null;
  }

  const index = Number(match[1]);
  const total = Number(match[2]);
  if (total < 1 || total > MAX_PARTS || index < 1 || index > total) {
    return null;
  }
  if (!BASE64_PATTERN.test(chunk)) {
    return null;
  }

  return { type: 'cipher', frameId, index, total, chunk };
};

/**
 * Parse a CTCP body (delimiters already stripped) into a frame.
 *
 * Returns `null` for anything malformed. Callers treat that as "not ours" and
 * fall through to the normal CTCP handling — a hostile or buggy peer must not
 * be able to reach any state machine with garbage.
 */
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

// --- Reassembly ---

interface PendingFrame {
  parts: (string | undefined)[];
  total: number;
  received: number;
  expiresAt: number;
}

export interface Reassembler {
  /**
   * Feed in a chunk. Returns the complete base64 payload once the last piece
   * arrives, otherwise `null`. Chunks may arrive in any order.
   */
  accept: (peer: string, frame: Extract<E2eeFrame, { type: 'cipher' }>, now?: number) => string | null;
  /** Drop everything buffered for a peer — used when a session ends. */
  forget: (peer: string) => void;
  /** Drop everything. */
  clear: () => void;
  /** Number of incomplete messages currently buffered. Exposed for tests. */
  readonly size: number;
}

/**
 * Buffer for multi-frame messages.
 *
 * The caps matter: without them a peer could pin memory by opening thousands of
 * frames and never finishing any of them. Incomplete messages expire, the
 * buffer is bounded, and the oldest entry is evicted once it is full.
 */
export const createReassembler = (): Reassembler => {
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

      const key = `${peer.toLowerCase()} ${frame.frameId}`;
      let entry = pending.get(key);

      // A total that disagrees with what we already hold means a resent or forged
      // frame; start over from the newer claim rather than mixing the two.
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

      // Ignore a duplicate index instead of overwriting: the first copy is the
      // one whose arrival we already accounted for.
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
      const prefix = `${peer.toLowerCase()} `;
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
