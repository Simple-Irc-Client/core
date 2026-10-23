import { E2eeState, getSessionKey, useE2eeStore } from '@features/e2ee/store/e2ee';
import { useSettingsStore } from '@features/settings/store/settings';

/** Whether plaintext extras like reactions and replies can go to the window: connected, and not an encrypted conversation */
export const useCanSendPlaintext = (window: string): boolean => {
  const isConnected = useSettingsStore((state) => state.isConnected);
  const isEncrypted = useE2eeStore((state) => state.sessions[getSessionKey(window)]?.state === E2eeState.active);

  return isConnected && !isEncrypted;
};
