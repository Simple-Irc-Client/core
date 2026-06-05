/**
 * Runtime-aware IRC transport. Re-exports the same names that
 * `directWebSocket.ts` does, but each one routes to either the WebSocket
 * implementation (browser) or the Tauri implementation (desktop).
 *
 * Network kernel imports from this file so it remains transport-agnostic.
 */
import { isDesktop } from '@/runtime/desktop';
import { type Server } from './servers';
import {
  initDirectWebSocket as wsInit,
  sendDirectRaw as wsSend,
  isDirectConnected as wsIsConnected,
  isDirectConnecting as wsIsConnecting,
  disconnectDirect as wsDisconnect,
  setDirectEventCallback as wsSetCallback,
  setDirectEncryption as wsSetEncryption,
} from './directWebSocket';
import {
  initTauriIrc,
  sendTauriRaw,
  isTauriConnected,
  isTauriConnecting,
  disconnectTauriIrc,
  setTauriEventCallback,
  setTauriEncryption,
} from './tauriTransport';

export const initDirectWebSocket = (server: Server): void => {
  if (isDesktop()) {
    initTauriIrc(server);
  } else {
    wsInit(server);
  }
};

export const sendDirectRaw = async (line: string): Promise<void> => {
  if (isDesktop()) {
    await sendTauriRaw(line);
  } else {
    await wsSend(line);
  }
};

export const isDirectConnected = (): boolean =>
  isDesktop() ? isTauriConnected() : wsIsConnected();

export const isDirectConnecting = (): boolean =>
  isDesktop() ? isTauriConnecting() : wsIsConnecting();

export const disconnectDirect = (): void => {
  if (isDesktop()) {
    disconnectTauriIrc();
  } else {
    wsDisconnect();
  }
};

// Both transports register the same callback so a runtime switch is harmless.
export const setDirectEventCallback = (
  callback: (eventName: string, data: unknown) => void,
): void => {
  wsSetCallback(callback);
  setTauriEventCallback(callback);
};

export const setDirectEncryption = (enabled: boolean): void => {
  wsSetEncryption(enabled);
  setTauriEncryption(enabled);
};
