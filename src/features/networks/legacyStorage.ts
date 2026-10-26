// Versions before networks were kept apart stored one network's data under its name; this moves it under NetworkId

import { get, set, del } from 'idb-keyval';
import { type Server } from '@/network/irc/servers';
import { ChannelCategory } from '@shared/types';
import { networkIdOf, type NetworkId } from './networkId';

const SETTINGS_KEY = 'sic-settings';
const NETWORKS_KEY = 'sic-networks';
/** The settings version that no longer holds the session */
export const SETTINGS_VERSION_WITHOUT_SESSION = 5;

interface LegacySession {
  server: Server;
  nick: string;
  wantedNick: string | undefined;
  currentChannelName: string;
  currentChannelCategory: ChannelCategory;
}

const readStored = (key: string): { state?: Record<string, unknown>; version?: number } | undefined => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : (JSON.parse(raw) as { state?: Record<string, unknown>; version?: number });
  } catch {
    return undefined;
  }
};

/** The session the settings of an older version kept; none once they are migrated */
const readLegacySession = (): LegacySession | undefined => {
  const stored = readStored(SETTINGS_KEY);
  const state = stored?.state;
  const server = state?.server as Server | undefined;
  if (state === undefined || server === undefined || (stored?.version ?? 0) >= SETTINGS_VERSION_WITHOUT_SESSION) {
    return undefined;
  }
  return {
    server,
    nick: typeof state.nick === 'string' ? state.nick : '',
    wantedNick: typeof state.wantedNick === 'string' ? state.wantedNick : undefined,
    currentChannelName: typeof state.currentChannelName === 'string' ? state.currentChannelName : 'Status',
    currentChannelCategory: (state.currentChannelCategory as ChannelCategory | undefined) ?? ChannelCategory.status,
  };
};

/** The networks store as an older version's settings describe it, or null when they describe none */
export const legacyNetworksJson = (): string | null => {
  const session = readLegacySession();
  if (session === undefined) {
    return null;
  }
  const networkId = networkIdOf(session.server);
  return JSON.stringify({ state: { activeNetworkId: networkId, sessions: { [networkId]: session } }, version: 1 });
};

/** For the settings migration: their session must reach the networks store before they drop it */
export const saveLegacyNetworks = (): void => {
  const legacy = legacyNetworksJson();
  if (legacy !== null && localStorage.getItem(NETWORKS_KEY) === null) {
    localStorage.setItem(NETWORKS_KEY, legacy);
  }
};

/** The network in use when the stores are migrated, from whichever of them holds it yet */
const lastActiveServer = (): Server | undefined => {
  const networks = readStored(NETWORKS_KEY)?.state as { activeNetworkId?: NetworkId; sessions?: Record<NetworkId, { server: Server }> } | undefined;
  const activeNetworkId = networks?.activeNetworkId;
  const saved = activeNetworkId === undefined ? undefined : networks?.sessions?.[activeNetworkId]?.server;
  return saved ?? readLegacySession()?.server;
};

/** The bouncer network whose data an older version kept under the bouncer's name, with that name */
const legacyBouncerOwner = (): { legacyKey: string; networkId: NetworkId } | undefined => {
  const server = lastActiveServer();
  if (server?.bouncer?.networkId === undefined) {
    return undefined;
  }
  return { legacyKey: server.network, networkId: networkIdOf(server) };
};

/** Data kept per network name: what an older version shared by all networks of a bouncer goes to the one then in use */
export const rekeyLegacyNetworks = <T>(byNetwork: Record<string, T>): Record<string, T> => {
  const owner = legacyBouncerOwner();
  const value = owner === undefined ? undefined : byNetwork[owner.legacyKey];
  if (owner === undefined || value === undefined) {
    return byNetwork;
  }
  const { [owner.legacyKey]: _moved, ...others } = byNetwork;
  return { ...others, [owner.networkId]: value };
};

/** The E2EE identity an older version kept under a bouncer's name goes to the bouncer network then in use */
export const moveLegacyBouncerIdentity = async (identityKeyPrefix: string): Promise<void> => {
  const owner = legacyBouncerOwner();
  if (owner === undefined) {
    return;
  }
  const legacyKey = `${identityKeyPrefix}:${owner.legacyKey}`;
  try {
    const identity: unknown = await get(legacyKey);
    if (identity !== undefined) {
      await set(`${identityKeyPrefix}:${owner.networkId}`, identity);
      await del(legacyKey);
    }
  } catch (error) {
    // The network makes a new identity; peers see a new fingerprint
    console.warn('E2EE: could not move the stored identity to its network:', error);
  }
};

/** The keys an older version saved `server`'s network's channels under, one per server of it, its own first */
export const legacyChannelKeys = (baseName: string, server: Server): string[] => {
  const bouncerSuffix = server.bouncer?.networkId === undefined ? '' : `:${server.bouncer.networkId}`;
  const own = server.servers[server.default];
  const hosts = own === undefined ? server.servers : [own, ...server.servers.filter((host) => host !== own)];
  return hosts.map((host) => `${baseName}:${server.network}:${host}${bouncerSuffix}`);
};
