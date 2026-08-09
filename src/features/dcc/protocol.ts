/**
 * DCC (Direct Client-to-Client) CTCP protocol layer.
 *
 * Pure parsing/serialisation — no sockets, no stores, no React. Everything the
 * rest of the feature needs to decide *whether* to trust an offer is decided
 * here, so the untrusted-input surface is one small, exhaustively tested file.
 *
 * Wire format (inside the \x01 delimiters the kernel already strips):
 *   DCC CHAT  chat <ip> <port>
 *   DCC SCHAT chat <ip> <port>            (TLS)
 *   DCC SEND  <filename> <ip> <port> <size>
 *   DCC SSEND <filename> <ip> <port> <size>   (TLS)
 *
 * <ip> is an unsigned 32-bit decimal for IPv4 (the historical mIRC encoding) or
 * a literal address for IPv6. Filenames containing spaces are "double quoted".
 */
import { isPrivateHost } from '@shared/lib/utils';

export const DccKind = {
  chat: 'chat',
  send: 'send',
} as const;

export type DccKind = (typeof DccKind)[keyof typeof DccKind];

export interface DccOffer {
  kind: DccKind;
  /** True for the SCHAT/SSEND variants, which wrap the socket in TLS */
  secure: boolean;
  host: string;
  port: number;
  /** Sanitised filename — `send` only */
  filename?: string;
  /** Announced byte count — `send` only */
  size?: number;
}

export const DccRejectReason = {
  malformed: 'malformed',
  unknownType: 'unknownType',
  badAddress: 'badAddress',
  badPort: 'badPort',
  badSize: 'badSize',
  privateAddress: 'privateAddress',
  passiveUnsupported: 'passiveUnsupported',
  badFilename: 'badFilename',
  tooLarge: 'tooLarge',
} as const;

export type DccRejectReason = (typeof DccRejectReason)[keyof typeof DccRejectReason];

export interface DccParseFailure {
  ok: false;
  reason: DccRejectReason;
}

export interface DccParseSuccess {
  ok: true;
  offer: DccOffer;
}

export type DccParseResult = DccParseSuccess | DccParseFailure;

export interface DccParseOptions {
  /** Accept offers pointing at loopback/RFC1918/link-local addresses */
  allowPrivateAddress?: boolean;
  /** Reject SEND offers announcing more than this many bytes */
  maxFileSize?: number;
}

/** 8 GiB. Large enough for real transfers, small enough to bound disk use. */
export const DEFAULT_MAX_FILE_SIZE = 8 * 1024 * 1024 * 1024;

/** Filesystem-safe cap; most filesystems stop at 255 bytes. */
const MAX_FILENAME_LENGTH = 200;

const MAX_UINT32 = 0xffffffff;

/**
 * Decode the historical unsigned-32-bit IPv4 encoding, or pass through a
 * literal IPv6 address. Returns null when the value is neither.
 *
 * Note `0` decodes to 0.0.0.0 rather than being rejected here — the private
 * address check downstream is what refuses it, so the reason reported to the
 * user is accurate.
 */
export const decodeDccAddress = (raw: string): string | null => {
  if (/^\d+$/.test(raw)) {
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 0 || value > MAX_UINT32) {
      return null;
    }
    return [
      (value >>> 24) & 0xff,
      (value >>> 16) & 0xff,
      (value >>> 8) & 0xff,
      value & 0xff,
    ].join('.');
  }

  // Literal IPv6 — accept the bracketed and bare forms, reject anything that
  // isn't plausibly an address so we never hand a hostname to the connector.
  const bare = raw.startsWith('[') && raw.endsWith(']') ? raw.slice(1, -1) : raw;
  if (/^[\da-fA-F:.]+$/.test(bare) && bare.includes(':')) {
    return bare.toLowerCase();
  }

  return null;
};

/**
 * True when `host` is a literal IP address rather than a name.
 *
 * Used to decide whether a peer's IRC hostname is usable as a "only accept a
 * connection from this address" constraint. Most networks cloak hostnames, so
 * this is false far more often than not — and constraining on a cloak would
 * reject the real peer.
 */
export const isIpLiteral = (host: string): boolean => {
  const bare = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(bare);
  if (ipv4) {
    return ipv4.slice(1).every((part) => Number(part) <= 255);
  }

  return /^[\da-fA-F:]+$/.test(bare) && bare.includes(':');
};

/** Encode an IPv4 address as the unsigned 32-bit decimal DCC expects. */
export const encodeDccAddress = (host: string): string => {
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ipv4) {
    // IPv6 goes on the wire literally; there is no 32-bit encoding for it.
    return host;
  }
  const parts = ipv4.slice(1).map(Number);
  if (parts.some((part) => part > 255)) {
    return host;
  }
  const [a = 0, b = 0, c = 0, d = 0] = parts;
  return String(((a << 24) >>> 0) + (b << 16) + (c << 8) + d);
};

/**
 * Reduce a peer-supplied filename to something safe to create inside the
 * download directory. Directory traversal, absolute paths, control characters
 * and Windows reserved characters are all removed rather than rejected, so a
 * merely awkward name still transfers; an empty result means "unusable".
 */
export const sanitizeFilename = (raw: string): string | null => {
  // Take the last path component under both separators before stripping, so
  // "../../etc/passwd" and "..\\..\\win.ini" both collapse to the leaf.
  const leaf = raw.split(/[/\\]/).pop() ?? '';

  const cleaned = leaf
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/[<>:"|?*]/g, '_')
    .replace(/^\.+/, '')
    .trim();

  if (cleaned.length === 0 || cleaned === '.' || cleaned === '..') {
    return null;
  }

  if (cleaned.length <= MAX_FILENAME_LENGTH) {
    return cleaned;
  }

  // Truncate the stem, never the extension — a .zip that arrives as .zi is
  // worse than a shortened name.
  const dot = cleaned.lastIndexOf('.');
  if (dot <= 0 || cleaned.length - dot > 16) {
    return cleaned.slice(0, MAX_FILENAME_LENGTH);
  }
  const ext = cleaned.slice(dot);
  return cleaned.slice(0, MAX_FILENAME_LENGTH - ext.length) + ext;
};

/**
 * Split DCC parameters, honouring one level of double quoting around the
 * filename. `"my holiday.jpg" 3232235777 5000 1024` yields four fields.
 */
const splitDccParams = (params: string): string[] => {
  const fields: string[] = [];
  let index = 0;

  while (index < params.length) {
    while (params[index] === ' ') {
      index += 1;
    }
    if (index >= params.length) {
      break;
    }

    if (params[index] === '"') {
      const close = params.indexOf('"', index + 1);
      if (close === -1) {
        // Unterminated quote: treat the remainder as one field rather than
        // silently dropping it, and let validation decide.
        fields.push(params.slice(index + 1));
        break;
      }
      fields.push(params.slice(index + 1, close));
      index = close + 1;
    } else {
      const space = params.indexOf(' ', index);
      if (space === -1) {
        fields.push(params.slice(index));
        break;
      }
      fields.push(params.slice(index, space));
      index = space + 1;
    }
  }

  return fields;
};

const parsePort = (raw: string): number | null => {
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const port = Number(raw);
  if (!Number.isSafeInteger(port) || port < 0 || port > 65535) {
    return null;
  }
  return port;
};

const parseSize = (raw: string): number | null => {
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const size = Number(raw);
  if (!Number.isSafeInteger(size) || size < 0) {
    return null;
  }
  return size;
};

const fail = (reason: DccRejectReason): DccParseFailure => ({ ok: false, reason });

/**
 * Parse the parameter part of a `DCC ...` CTCP (i.e. everything after the
 * literal `DCC`). Never throws.
 */
export const parseDccCtcp = (params: string, options: DccParseOptions = {}): DccParseResult => {
  const { allowPrivateAddress = false, maxFileSize = DEFAULT_MAX_FILE_SIZE } = options;

  const fields = splitDccParams(params);
  const type = fields.shift()?.toUpperCase();

  if (type === undefined) {
    return fail(DccRejectReason.malformed);
  }

  let kind: DccKind;
  let secure: boolean;

  switch (type) {
    case 'CHAT':
      kind = DccKind.chat;
      secure = false;
      break;
    case 'SCHAT':
      kind = DccKind.chat;
      secure = true;
      break;
    case 'SEND':
      kind = DccKind.send;
      secure = false;
      break;
    case 'SSEND':
      kind = DccKind.send;
      secure = true;
      break;
    default:
      // RESUME/ACCEPT/XMIT and anything else are not implemented yet.
      return fail(DccRejectReason.unknownType);
  }

  // CHAT's first field is the literal sub-protocol ("chat"); SEND's is the
  // filename. Both are followed by <ip> <port> [size].
  const first = fields.shift();
  if (first === undefined) {
    return fail(DccRejectReason.malformed);
  }

  const rawHost = fields.shift();
  const rawPort = fields.shift();
  if (rawHost === undefined || rawPort === undefined) {
    return fail(DccRejectReason.malformed);
  }

  const host = decodeDccAddress(rawHost);
  if (host === null) {
    return fail(DccRejectReason.badAddress);
  }

  const port = parsePort(rawPort);
  if (port === null) {
    return fail(DccRejectReason.badPort);
  }
  if (port === 0) {
    // Port 0 means passive ("reverse") DCC, which needs the token exchange we
    // do not implement yet. Reject explicitly so the user sees why.
    return fail(DccRejectReason.passiveUnsupported);
  }
  if (port < 1024) {
    // Privileged ports are never a legitimate DCC listener and are a classic
    // way to make a client speak to an unrelated service.
    return fail(DccRejectReason.badPort);
  }

  if (!allowPrivateAddress && isPrivateHost(host)) {
    return fail(DccRejectReason.privateAddress);
  }

  if (kind === DccKind.chat) {
    if (first.toLowerCase() !== 'chat') {
      return fail(DccRejectReason.malformed);
    }
    return { ok: true, offer: { kind, secure, host, port } };
  }

  const rawSize = fields.shift();
  if (rawSize === undefined) {
    return fail(DccRejectReason.malformed);
  }
  const size = parseSize(rawSize);
  if (size === null) {
    return fail(DccRejectReason.badSize);
  }
  if (size > maxFileSize) {
    return fail(DccRejectReason.tooLarge);
  }

  const filename = sanitizeFilename(first);
  if (filename === null) {
    return fail(DccRejectReason.badFilename);
  }

  return { ok: true, offer: { kind, secure, host, port, filename, size } };
};

/**
 * Build the CTCP payload for an outgoing offer (without the \x01 delimiters).
 */
export const formatDccCtcp = (offer: DccOffer): string => {
  const address = encodeDccAddress(offer.host);

  if (offer.kind === DccKind.chat) {
    return `DCC ${offer.secure ? 'SCHAT' : 'CHAT'} chat ${address} ${offer.port}`;
  }

  const name = offer.filename ?? 'file';
  // Only quote when necessary — some older clients mishandle always-quoted names.
  const quoted = name.includes(' ') ? `"${name}"` : name;
  return `DCC ${offer.secure ? 'SSEND' : 'SEND'} ${quoted} ${address} ${offer.port} ${offer.size ?? 0}`;
};

/** Append `(1)`, `(2)`, … before the extension until the name is unused. */
export const dedupeFilename = (filename: string, taken: (name: string) => boolean): string => {
  if (!taken(filename)) {
    return filename;
  }

  const dot = filename.lastIndexOf('.');
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : '';

  for (let counter = 1; counter < 1000; counter += 1) {
    const candidate = `${stem} (${counter})${ext}`;
    if (!taken(candidate)) {
      return candidate;
    }
  }

  return `${stem} (${Date.now()})${ext}`;
};
