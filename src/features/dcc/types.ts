import type { DccKind } from './protocol';

export const DccDirection = {
  incoming: 'incoming',
  outgoing: 'outgoing',
} as const;

export type DccDirection = (typeof DccDirection)[keyof typeof DccDirection];

export const DccStatus = {
  /** Offer received, waiting for the user to accept or decline */
  pending: 'pending',
  /** We are listening for the peer, or dialling them */
  connecting: 'connecting',
  /** Socket up: chat lines flowing, or bytes moving */
  active: 'active',
  completed: 'completed',
  failed: 'failed',
  declined: 'declined',
  cancelled: 'cancelled',
} as const;

export type DccStatus = (typeof DccStatus)[keyof typeof DccStatus];

export interface DccSession {
  id: string;
  kind: DccKind;
  direction: DccDirection;
  status: DccStatus;
  secure: boolean;
  /** The other side's nick as seen on IRC */
  nick: string;
  host: string;
  port: number;
  /** `send` only */
  filename?: string;
  /** `send` only — total announced bytes */
  size?: number;
  /** `send` only — bytes transferred so far */
  transferred?: number;
  /** Bytes per second, smoothed; `send` only */
  rate?: number;
  /** Absolute path the file was written to; `send` incoming only */
  path?: string;
  /** SHA-256 of the peer certificate, `secure` sessions only */
  fingerprint?: string;
  /** Populated when `status` is `failed`; already translated */
  error?: string;
  /** Chat window name for `chat` sessions (`=nick`, the mIRC convention) */
  channelName?: string;
  startedAt: number;
  updatedAt: number;
}

/** Events the platform transport pushes back at the manager. */
export type DccTransportEvent =
  | { type: 'listening'; port: number }
  | { type: 'connected'; fingerprint?: string }
  | { type: 'line'; text: string }
  | { type: 'progress'; transferred: number }
  | { type: 'completed'; path?: string }
  | { type: 'closed' }
  | { type: 'error'; message: string };

export interface DccListenOptions {
  secure: boolean;
  /** Inclusive listen-port range; the transport picks a free port inside it */
  portRange: [number, number];
  /** Only accept an inbound socket from this address */
  expectPeer?: string;
  /** Absolute path of the file to serve; chat sessions omit it */
  filePath?: string;
}

export interface DccConnectOptions {
  host: string;
  port: number;
  secure: boolean;
  /** Where to write an incoming file; chat sessions omit it */
  savePath?: string;
  /** Expected byte count, so the transport can detect a short/long transfer */
  size?: number;
}

/**
 * Platform surface DCC needs. Implemented by the Tauri bridge on desktop and by
 * a rejecting stub in the browser (see `transport.ts`).
 */
export interface DccTransport {
  readonly available: boolean;
  /** Open a listening socket and resolve once it is bound. */
  listen: (
    sessionId: string,
    options: DccListenOptions,
    onEvent: (event: DccTransportEvent) => void,
  ) => Promise<{ host: string; port: number }>;
  connect: (
    sessionId: string,
    options: DccConnectOptions,
    onEvent: (event: DccTransportEvent) => void,
  ) => Promise<void>;
  sendLine: (sessionId: string, text: string) => Promise<void>;
  close: (sessionId: string) => Promise<void>;
  /** Absolute path for `filename` inside the configured download directory. */
  resolveDownloadPath: (directory: string | null, filename: string) => Promise<string>;
  /** True when a file already exists at `path`. */
  exists: (path: string) => Promise<boolean>;
}

export class DccUnsupportedError extends Error {
  constructor() {
    super('DCC_UNSUPPORTED');
    this.name = 'DccUnsupportedError';
  }
}
