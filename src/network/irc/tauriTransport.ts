/**
 * Tauri IRC transport. Mirrors the public surface of `directWebSocket.ts`
 * so `transport.ts` can swap them at runtime without the kernel knowing
 * which one is in play. Routes raw IRC lines through the `irc_*` Tauri
 * commands and listens on the per-connection event channel.
 */
import { invoke, Channel } from '@tauri-apps/api/core';
import { type Server } from './servers';
import { parseServer } from './helpers';

type TauriIrcEvent =
  | { type: 'socketConnected' }
  | { type: 'raw'; line: string }
  | { type: 'closed' }
  | { type: 'error'; message: string };

let connectionId: string | null = null;
let isConnectingFlag = false;
let isConnectedFlag = false;
let eventCallback: ((eventName: string, data: unknown) => void) | null = null;

const triggerEvent = (eventName: string, data: unknown): void => {
  eventCallback?.(eventName, data);
};

const cleanup = (): void => {
  // The Rust driver stops sending on its channel once the connection ends,
  // so there is no subscription to tear down — just forget the id.
  connectionId = null;
};

const handleEvent = (payload: TauriIrcEvent): void => {
  switch (payload.type) {
    case 'socketConnected':
      isConnectingFlag = false;
      isConnectedFlag = true;
      // Routed through the same 'sic-irc-event' channel the kernel listens on
      // (like 'raw'/'close'), so the kernel's handleConnect runs and sends the
      // registration burst. A bare 'connect' event name has no subscriber.
      triggerEvent('sic-irc-event', { type: 'connect' });
      break;
    case 'raw':
      // The driver only emits inbound lines now (no outbound echo), so forward
      // every one straight to the kernel.
      triggerEvent('sic-irc-event', { type: 'raw', line: payload.line });
      break;
    case 'error':
      // Surface the reason to the kernel (status window) rather than dropping
      // it. A fatal error is followed by 'closed'.
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
      // Create the channel BEFORE invoking so the event sink exists before
      // the Rust driver produces its first event. This closes the race the
      // old emit/listen pair had, where the registration burst and the
      // `connected` event could be emitted before `listen()` attached.
      const channel = new Channel<TauriIrcEvent>();
      channel.onmessage = handleEvent;
      const id = await invoke<string>('irc_connect', {
        options: {
          host: parsed.host,
          port,
          tls,
          encoding: server.encoding ?? 'utf8',
        },
        onEvent: channel,
      });
      connectionId = id;
    } catch (err) {
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
  cleanup();
  isConnectingFlag = false;
  isConnectedFlag = false;
  if (id) {
    void invoke('irc_disconnect', { id }).catch(() => {
      // already gone — no kernel-visible event needed
    });
  }
};
