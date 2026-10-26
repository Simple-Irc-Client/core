import { E2eeState, getSessionKey, useActiveE2ee } from '@features/e2ee/store/e2ee';
import { useActiveSession } from '@features/networks/store/networks';

/** Whether plaintext extras like reactions and replies can go to the window: connected, and not an encrypted conversation */
export const useCanSendPlaintext = (window: string): boolean => {
  const isConnected = useActiveSession((session) => session.isConnected);
  const isEncrypted = useActiveE2ee((slice) => slice.sessions[getSessionKey(window)]?.state === E2eeState.active);

  return isConnected && !isEncrypted;
};
