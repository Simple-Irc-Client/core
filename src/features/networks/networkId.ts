import { type Server } from '@/network/irc/servers';

/** One IRC network: all its servers share it, and each network on a bouncer is one of its own */
export type NetworkId = string;

export const networkIdOf = (server: Server): NetworkId => {
  const bouncerNetwork = server.bouncer?.networkId;
  return bouncerNetwork === undefined ? server.network : `${server.network}/bouncer:${bouncerNetwork}`;
};
