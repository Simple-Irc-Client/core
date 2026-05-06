/**
 * Tauri IRC transport. Mirrors the public surface of `directWebSocket.ts`
 * so `transport.ts` can swap them at runtime without the kernel knowing
 * which one is in play. Routes raw IRC lines through the `irc_*` Tauri
 * commands and listens on the per-connection event channel.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { type Server } from './servers';
import { parseServer } from './helpers';

type TauriIrcEvent =
  | { type: 'socketConnected' }
  | { type: 'connected' }
  | { type: 'raw'; line: string; fromServer: boolean }
  | { type: 'capTimeout'; retries: number }
  | { type: 'closed' }
  | { type: 'error'; message: string };

let connectionId: string | null = null;
let isConnectingFlag = false;
let isConnectedFlag = false;
let unlisten: UnlistenFn | null = null;
let eventCallback: ((eventName: string, data: unknown) => void) | null = null;

const triggerEvent = (eventName: string, data: unknown): void => {
  eventCallback?.(eventName, data);
};

const cleanup = (): void => {
  connectionId = null;
  if (unlisten) {
    void unlisten();
    unlisten = null;
  }
};

const handleEvent = (payload: TauriIrcEvent): void => {
  switch (payload.type) {
    case 'socketConnected':
      isConnectingFlag = false;
      isConnectedFlag = true;
      triggerEvent('connect', {});
      break;
    case 'connected':
      triggerEvent('sic-irc-event', { type: 'connected' });
      break;
    case 'raw':
      // Outbound lines are echoed too (fromServer: false). The kernel only
      // expects inbound raw events, so drop the echoes to match WebSocket
      // transport behaviour.
      if (payload.fromServer) {
        triggerEvent('sic-irc-event', { type: 'raw', line: payload.line });
      }
      break;
    case 'capTimeout':
      // No kernel hook for this today; silently move on.
      break;
    case 'error':
      triggerEvent('error', new Error(payload.message));
      break;
    case 'closed':
      isConnectedFlag = false;
      isConnectingFlag = false;
      triggerEvent('sic-irc-event', { type: 'close' });
      cleanup();
      break;
  }
};

export const setTauriEventCallback = (
  callback: (eventName: string, data: unknown) => void,
): void => {
  eventCallback = callback;
};

export const setTauriEncryption = (enabled: boolean): void => {
  // Tauri IPC is in-process — no transport encryption to toggle.
  void enabled;
};

export const initTauriIrc = (server: Server, nick: string): void => {
  if (isConnectingFlag) {
    throw new Error('Tauri IRC connection already in progress');
  }
  // Tear down any prior connection silently before starting a new one.
  if (connectionId !== null) {
    const oldId = connectionId;
    cleanup();
    void invoke('irc_disconnect', { id: oldId }).catch(() => {
      // already gone
    });
  }

  const parsed = parseServer(server);
  if (!parsed?.host) {
    throw new Error('Unable to connect - server host is empty');
  }

  isConnectingFlag = true;
  isConnectedFlag = false;

  const tls = server.tls ?? false;
  const port = parsed.port ?? (tls ? 6697 : 6667);

  void (async () => {
    try {
      const id = await invoke<string>('irc_connect', {
        options: {
          host: parsed.host,
          port,
          tls,
          encoding: server.encoding ?? 'utf8',
          registration: {
            nick,
            username: nick,
            gecos: nick,
          },
        },
      });
      connectionId = id;
      unlisten = await listen<TauriIrcEvent>(`irc://${id}`, (event) => {
        handleEvent(event.payload);
      });
    } catch (err) {
      isConnectingFlag = false;
      isConnectedFlag = false;
      triggerEvent('error', err);
      triggerEvent('sic-irc-event', { type: 'close' });
    }
  })();
};

export const sendTauriRaw = async (line: string): Promise<void> => {
  if (!connectionId) {
    return;
  }
  try {
    await invoke('irc_send', { id: connectionId, line });
  } catch (err) {
    triggerEvent('error', err);
  }
};

export const isTauriConnected = (): boolean => isConnectedFlag;
export const isTauriConnecting = (): boolean => isConnectingFlag;

export const disconnectTauriIrc = (): void => {
  const id = connectionId;
  cleanup();
  isConnectingFlag = false;
  isConnectedFlag = false;
  if (id) {
    void invoke('irc_disconnect', { id }).catch(() => {
      // already gone — no kernel-visible event needed
    });
  }
};
