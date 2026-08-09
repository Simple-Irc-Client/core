/**
 * Runtime-aware DCC transport, mirroring `src/network/irc/transport.ts`.
 *
 * DCC needs a raw TCP socket in both directions, which a browser cannot open.
 * On desktop this routes to the `dcc_*` Tauri commands; everywhere else every
 * call rejects with `DccUnsupportedError` and the manager turns that into a
 * polite auto-decline. Filesystem work (resolving the download directory,
 * checking for an existing file, picking a file to send) also lives behind
 * Tauri commands rather than a plugin, so the browser build pulls in nothing.
 */
import { Channel, invoke } from '@tauri-apps/api/core';
import { isDesktop } from '@/runtime/desktop';
import {
  DccUnsupportedError,
  type DccConnectOptions,
  type DccListenOptions,
  type DccTransport,
  type DccTransportEvent,
} from './types';

const unavailable = async (): Promise<never> => {
  throw new DccUnsupportedError();
};

const browserTransport: DccTransport = {
  available: false,
  listen: unavailable,
  connect: unavailable,
  sendLine: unavailable,
  close: unavailable,
  resolveDownloadPath: unavailable,
  exists: unavailable,
};

/**
 * Create the event channel *before* invoking, so the Rust driver can never emit
 * into a channel with no listener attached — the same ordering `irc_connect`
 * depends on.
 */
const makeChannel = (onEvent: (event: DccTransportEvent) => void): Channel<DccTransportEvent> => {
  const channel = new Channel<DccTransportEvent>();
  channel.onmessage = onEvent;
  return channel;
};

const tauriTransport: DccTransport = {
  available: true,

  listen: async (sessionId, options: DccListenOptions, onEvent) => {
    const onDccEvent = makeChannel(onEvent);
    return invoke<{ host: string; port: number }>('dcc_listen', {
      sessionId,
      options: {
        secure: options.secure,
        portStart: options.portRange[0],
        portEnd: options.portRange[1],
        expectPeer: options.expectPeer ?? null,
        filePath: options.filePath ?? null,
      },
      onDccEvent,
    });
  },

  connect: async (sessionId, options: DccConnectOptions, onEvent) => {
    const onDccEvent = makeChannel(onEvent);
    await invoke('dcc_connect', {
      sessionId,
      options: {
        host: options.host,
        port: options.port,
        secure: options.secure,
        savePath: options.savePath ?? null,
        size: options.size ?? null,
      },
      onDccEvent,
    });
  },

  sendLine: async (sessionId, text) => {
    await invoke('dcc_send_line', { sessionId, line: text });
  },

  close: async (sessionId) => {
    await invoke('dcc_close', { sessionId });
  },

  resolveDownloadPath: async (directory, filename) =>
    invoke<string>('dcc_resolve_path', { directory, filename }),

  exists: async (path) => invoke<boolean>('dcc_exists', { path }),
};

export const getDccTransport = (): DccTransport =>
  isDesktop() ? tauriTransport : browserTransport;

export const isDccAvailable = (): boolean => isDesktop();

/** Native "choose a file to send" dialog. Desktop only. */
export const pickFileToSend = async (): Promise<{ path: string; name: string; size: number } | null> => {
  if (!isDesktop()) {
    throw new DccUnsupportedError();
  }
  return invoke<{ path: string; name: string; size: number } | null>('dcc_pick_file');
};

/** Stat a path the user typed after `/dcc send`. Desktop only. */
export const statFileToSend = async (path: string): Promise<{ path: string; name: string; size: number }> => {
  if (!isDesktop()) {
    throw new DccUnsupportedError();
  }
  return invoke<{ path: string; name: string; size: number }>('dcc_stat_file', { path });
};

/** Native "choose download folder" dialog. Desktop only. */
export const pickDownloadDirectory = async (): Promise<string | null> => {
  if (!isDesktop()) {
    throw new DccUnsupportedError();
  }
  return invoke<string | null>('dcc_pick_directory');
};
