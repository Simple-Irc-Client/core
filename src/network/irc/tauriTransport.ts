// Same surface as directWebSocket.ts, so transport.ts can swap them at runtime
import { invoke, Channel } from '@tauri-apps/api/core';
import { type Server } from './servers';
import { parseServer } from './helpers';

type TauriIrcEvent =
  | { type: 'socketConnected' }
  | { type: 'raw'; line: string }
  | { type: 'closed' }
  | { type: 'error'; message: string };

let connectionId: string | null = null;
// Bumped on connect/disconnect so a superseded attempt's late results are ignored
let generation = 0;
let isConnectingFlag = false;
let isConnectedFlag = false;
let eventCallback: ((eventName: string, data: unknown) => void) | null = null;

const triggerEvent = (eventName: string, data: unknown): void => {
  eventCallback?.(eventName, data);
};

const cleanup = (): void => {
  connectionId = null;
};

const handleEvent = (payload: TauriIrcEvent): void => {
  switch (payload.type) {
    case 'socketConnected':
      isConnectingFlag = false;
      isConnectedFlag = true;
      // The kernel registers on this; a bare 'connect' event name has no subscriber
      triggerEvent('sic-irc-event', { type: 'connect' });
      break;
    case 'raw':
      triggerEvent('sic-irc-event', { type: 'raw', line: payload.line });
      break;
    case 'error':
      // A fatal error is followed by 'closed'
      triggerEvent('sic-irc-event', { type: 'error', line: payload.message });
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

export const initTauriIrc = (server: Server): void => {
  if (isConnectingFlag) {
    throw new Error('Tauri IRC connection already in progress');
  }
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

  const attempt = ++generation;
  isConnectingFlag = true;
  isConnectedFlag = false;

  const tls = server.tls ?? false;
  const port = parsed.port ?? (tls ? 6697 : 6667);

  void (async () => {
    try {
      // Created before invoking, so no event can arrive before the sink exists
      const channel = new Channel<TauriIrcEvent>();
      channel.onmessage = (payload) => {
        if (attempt === generation) {
          handleEvent(payload);
        }
      };
      const id = await invoke<string>('irc_connect', {
        options: {
          host: parsed.host,
          port,
          tls,
          encoding: server.encoding ?? 'utf8',
        },
        onEvent: channel,
      });
      if (attempt !== generation) {
        // Superseded while in flight: close the spawned connection rather than leak it
        void invoke('irc_disconnect', { id }).catch(() => {
          // already gone
        });
        return;
      }
      connectionId = id;
    } catch (err) {
      if (attempt !== generation) {
        return;
      }
      isConnectingFlag = false;
      isConnectedFlag = false;
      triggerEvent('sic-irc-event', { type: 'error', line: errorMessage(err) });
      triggerEvent('sic-irc-event', { type: 'close' });
    }
  })();
};

const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export const sendTauriRaw = async (line: string): Promise<void> => {
  if (!connectionId) {
    return;
  }
  try {
    await invoke('irc_send', { id: connectionId, line });
  } catch (err) {
    triggerEvent('sic-irc-event', { type: 'error', line: errorMessage(err) });
  }
};

export const isTauriConnected = (): boolean => isConnectedFlag;
export const isTauriConnecting = (): boolean => isConnectingFlag;

export const disconnectTauriIrc = (): void => {
  const id = connectionId;
  generation++;
  cleanup();
  isConnectingFlag = false;
  isConnectedFlag = false;
  if (id) {
    void invoke('irc_disconnect', { id }).catch(() => {
      // already gone — no kernel-visible event needed
    });
  }
};
