/**
 * SIC-E2EE v1 — wire format.
 *
 * Everything travels as CTCP — the same convention behind `/me` actions
 * (`\x01ACTION ...\x01`): wrap a payload in `\x01` bytes inside a normal
 * PRIVMSG/NOTICE, and any client that doesn't recognise the verb inside just
 * shows nothing, no stray text or error. `Kernel.handleCtcp` ends in
 * `default: // Unknown CTCP, ignore silently`, and virtually every other IRC
 * client does the same — that's the whole reason to use CTCP here rather than
 * a message tag: it degrades to silence on a peer running HexChat or irssi.
 *
 * Two CTCP verbs, sent as the literal text between the `\x01` delimiters:
 *
 *   SIC-E2EE OFFER 1 <identityKey> <ephemeralKey>   (PRIVMSG)
 *   SIC-E2EE ACCEPT 1 <identityKey> <ephemeralKey>  (NOTICE)
 *   SIC-E2EE DECLINE                                (NOTICE)
 *   SIC-E2EE RESET                                  (NOTICE)
 *   SICE <frameId> <index>/<total> <chunk>          (PRIVMSG)
 *
 * `SIC-E2EE` carries the handshake (see `session.ts`): trading public keys and
 * agreeing to encrypt. `SICE` carries the actual ciphertext — see `HANDSHAKE_CTCP`
 * and `CIPHER_CTCP` below for why it needs more than one line per message.
 */

/** Bumped only on an incompatible wire change; peers ignore versions they don't know. */
export const PROTOCOL_VERSION = '1';

/** CTCP verb for handshake frames: OFFER / ACCEPT / DECLINE / RESET. See the file header. */
export const HANDSHAKE_CTCP = 'SIC-E2EE';

/**
 * CTCP verb for a chunk of ciphertext. A single IRC line isn't always big
 * enough to hold a whole encrypted message, so `buildCipherFrames` below
 * splits one into several `SICE` lines, each carrying up to `MAX_CHUNK_CHARS`
 * of it plus an `<index>/<total>` header; `createReassembler` puts them back
 * together on arrival.
 */
export const CIPHER_CTCP = 'SICE';

/**
 * Base64 characters per chunk, when the server hasn't told us it can take
 * more (see `chunkCharsFor` below).
 *
 * The traditional IRC line limit is 512 bytes including CRLF, but what has to
 * fit is the line the *server* relays, which is our line plus a
 * `:nick!ident@host ` prefix we don't control and can't measure — a long
 * cloak runs to ~100 characters. Add the `PRIVMSG <target> :` envelope and the
 * frame header, and 320 leaves comfortable margin. Getting this wrong is not
 * a cosmetic bug: a truncated chunk makes the reassembled ciphertext fail GCM
 * authentication and the message is lost.
 */
export const DEFAULT_CHUNK_CHARS = 320;

/**
 * The gap between a server's advertised line length and how much of it we
 * actually get to fill with chunk data — the same `:nick!ident@host ` prefix,
 * `PRIVMSG <target> :` envelope, and frame header margin `DEFAULT_CHUNK_CHARS`
 * reserves out of the traditional 512-byte line (512 − 320). Treated as a
 * fixed cost regardless of the server's line length, since none of it scales
 * with how long a line the server is willing to relay.
 */
const LINE_LEN_OVERHEAD = 512 - DEFAULT_CHUNK_CHARS;

/** Never fragment below this, even if a server advertises an implausibly short line length. */
const MIN_CHUNK_CHARS = 32;

/**
 * How many base64 characters fit in one chunk on this server.
 *
 * Some servers advertise a longer (or shorter) line length than the
 * traditional 512 bytes via ISUPPORT's `LINELEN` token — see `kernel.ts`'s
 * `onRaw005`. When they do, chunking to match means fewer frames for a large
 * message on a server that allows more, and correctly smaller ones on a
 * server that allows less. `serverLineLen` is `0` when the server never sent
 * one, in which case `buildCipherFrames` keeps using `DEFAULT_CHUNK_CHARS`.
 */
export const chunkCharsFor = (serverLineLen: number): number =>
  serverLineLen > 0 ? Math.max(MIN_CHUNK_CHARS, serverLineLen - LINE_LEN_OVERHEAD) : DEFAULT_CHUNK_CHARS;

/** A single message may span at most this many frames (~5 KB of ciphertext). */
export const MAX_PARTS = 16;

/** Distinct incomplete messages held per peer set, before the oldest is evicted. */
const MAX_PENDING_FRAMES = 64;

/**
 * How long an incomplete message waits for its missing chunks before being
 * given up on and dropped.
 *
 * A message can be split into up to `MAX_PARTS` (16) separate IRC lines, and
 * every one of them has to actually arrive before it can be read. On a slow
 * connection, a client under load, or a server enforcing flood control (many
 * throttle a client to roughly one line every second or two once a burst
 * allowance runs out), sending all 16 can legitimately take the better part
 * of a minute — and this clock starts counting from the *first* chunk, not
 * the last. Too short a wait here means a real message quietly vanishes for
 * no reason visible to either person: the sender sees it as sent, the
 * receiver never sees anything arrive at all. Memory use is still bounded
 * regardless of this value, by `MAX_PENDING_FRAMES` below.
 */
export const FRAME_TTL_MS = 120_000;

/** Length in bytes of the random id `newFrameId` generates to tell a message's chunks apart from another message's. */
const FRAME_ID_LENGTH = 8;

/** A base64 string: letters, digits, `+`, `/`, with up to two `=` padding characters at the end. */
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * The `<index>/<total>` token from a `SICE` line, e.g. `3/16`. Both numbers are
 * capped at two digits because `MAX_PARTS` (16) never needs more; anything
 * longer is already malformed and `parseCipher` below rejects it before the
 * numbers are even inspected.
 */
const CHUNK_SEQUENCE_PATTERN = /^(?<index>\d{1,2})\/(?<total>\d{1,2})$/;

/** Message kinds carried inside the encrypted body. */
export const BodyKind = {
  /** An ordinary PRIVMSG body. */
  message: 'm',
  /** A CTCP ACTION body — `/me`. */
  action: 'a',
} as const;

export type BodyKind = (typeof BodyKind)[keyof typeof BodyKind];

/** A parsed, validated wire line — what `parseCtcpFrame` produces and `session.ts`'s state machine consumes. */
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

// ---------------------------------------------------------------------------
// Building — turn handshake data / ciphertext into wire lines
// ---------------------------------------------------------------------------

export const buildOfferFrame = (identityKeyB64: string, ephemeralKeyB64: string): string =>
  `${HANDSHAKE_CTCP} OFFER ${PROTOCOL_VERSION} ${identityKeyB64} ${ephemeralKeyB64}`;

export const buildAcceptFrame = (identityKeyB64: string, ephemeralKeyB64: string): string =>
  `${HANDSHAKE_CTCP} ACCEPT ${PROTOCOL_VERSION} ${identityKeyB64} ${ephemeralKeyB64}`;

export const buildDeclineFrame = (): string => `${HANDSHAKE_CTCP} DECLINE`;

export const buildResetFrame = (): string => `${HANDSHAKE_CTCP} RESET`;

/**
 * Split a sealed (encrypted) payload into one or more `SICE` CTCP bodies, each
 * carrying at most `chunkChars` of it plus an `<index>/<total>` header so the
 * receiver's `Reassembler` can put them back in order. `chunkChars` defaults
 * to `DEFAULT_CHUNK_CHARS`; pass `chunkCharsFor(getLineLenLimit())` to size it
 * to what this particular server actually allows.
 *
 * Throws if the message is too large to send, rather than emitting frames the
 * peer will discard — the caller surfaces that to the user as a failed send.
 */
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

/** Wrap a message body with its kind, so `/me` survives the round trip. */
export const encodeBody = (kind: BodyKind, text: string): string => `${kind}${text}`;

export const decodeBody = (plaintext: string): { kind: BodyKind; text: string } => {
  const marker = plaintext.slice(0, 1);
  const kind: BodyKind = marker === BodyKind.action ? BodyKind.action : BodyKind.message;

  // An unrecognised marker means a newer peer sent a kind we don't handle. Show
  // the body as a plain message rather than dropping it — the text is still real.
  return { kind, text: plaintext.slice(1) };
};

// ---------------------------------------------------------------------------
// Parsing — turn wire lines back into handshake data / ciphertext, rejecting
// anything malformed rather than guessing at what a peer meant.
// ---------------------------------------------------------------------------

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

/**
 * Parse one `SICE <frameId> <index>/<total> <chunk>` line (the CTCP verb
 * itself already stripped by the caller, so `params` is `[frameId,
 * "<index>/<total>", chunk]`).
 */
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

/**
 * Parse a CTCP body (the `\x01` delimiters already stripped) into a frame.
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

// ---------------------------------------------------------------------------
// Reassembly — put a message's chunks back together on the receiving side
// ---------------------------------------------------------------------------

/** One message's worth of chunks, still being collected. Tracked per `frameId` in `createReassembler`'s `pending` map. */
interface PendingFrame {
  /** One slot per chunk, filled in as each arrives; `undefined` where a chunk is still missing. */
  parts: (string | undefined)[];
  /** How many chunks this message was split into — every chunk that arrives must agree on this. */
  total: number;
  /** How many slots in `parts` are filled so far, so "are we done?" is a cheap comparison instead of scanning `parts`. */
  received: number;
  /** `Date.now()` value after which this entry is dropped even if incomplete — see `FRAME_TTL_MS`. */
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
  // Keyed by "<peer, lowercased> <frameId>", so two peers who happen to pick
  // the same random frameId at the same time don't collide with each other.
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
