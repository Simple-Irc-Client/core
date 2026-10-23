import { isCapabilityEnabled } from '@/network/irc/capabilities';

/** Whether the server relays a client tag (`draft/react`, without the `+`), per message-tags and the CLIENTTAGDENY list */
export const isClientTagAllowed = (name: string, deny: string[]): boolean => {
  if (!isCapabilityEnabled('message-tags')) {
    return false;
  }
  return deny.includes('*') ? deny.includes(`-${name}`) : !deny.includes(name);
};
