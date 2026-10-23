import { isClientTagAllowed } from '@/network/irc/clientTags';
import { E2eeState, getSessionKey, useE2eeStore } from '@features/e2ee/store/e2ee';
import { useSettingsStore } from '@features/settings/store/settings';

/** Reactions are plaintext, so encrypted conversations don't send them, as with typing */
export const useCanReact = (window: string): boolean => {
  const isConnected = useSettingsStore((state) => state.isConnected);
  const clientTagDeny = useSettingsStore((state) => state.clientTagDeny);
  const isEncrypted = useE2eeStore((state) => state.sessions[getSessionKey(window)]?.state === E2eeState.active);

  return isConnected && !isEncrypted && isClientTagAllowed('draft/react', clientTagDeny) && isClientTagAllowed('draft/reply', clientTagDeny);
};
