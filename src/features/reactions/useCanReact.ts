import { isClientTagAllowed } from '@/network/irc/clientTags';
import { useCanSendPlaintext } from '@features/chat/useCanSendPlaintext';
import { useSettingsStore } from '@features/settings/store/settings';

/** Reactions are plaintext, so encrypted conversations don't send them, as with typing */
export const useCanReact = (window: string): boolean => {
  const canSendPlaintext = useCanSendPlaintext(window);
  const clientTagDeny = useSettingsStore((state) => state.clientTagDeny);

  return canSendPlaintext && isClientTagAllowed('draft/react', clientTagDeny) && isClientTagAllowed('draft/reply', clientTagDeny);
};
