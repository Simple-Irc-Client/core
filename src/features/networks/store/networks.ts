// What the app knows about each IRC network it uses: the server, the nick and what the connection learned

import { create } from 'zustand';
import { createJSONStorage, devtools, persist, type StateStorage } from 'zustand/middleware';
import { type Server } from '@/network/irc/servers';
import { ChannelCategory, type ChannelMode, type UserMode } from '@shared/types';
import { defaultChannelTypes } from '@/config/config';
import { DEFAULT_CASE_MAPPING, namesEqual, type CaseMapping } from '@shared/lib/caseMapping';
import { networkIdOf, type NetworkId } from '../networkId';
import { legacyNetworksJson } from '../legacyStorage';

/** What one connection learns: the initial values, and what a new connection starts from */
const connectionDefaults = () => ({
  isConnecting: false,
  isConnected: false,
  connectedTime: 0, // unix timestamp
  userModes: [] as UserMode[],
  channelModes: { A: [], B: [], C: [], D: [] } as ChannelMode,
  listRequestRemainingSeconds: -1,
  channelTypes: [] as string[],
  caseMapping: DEFAULT_CASE_MAPPING as CaseMapping, // CASEMAPPING from 005, decides channel/nick name identity
  supportedOptions: [] as string[],
  currentUserFlags: [] as string[], // Current user's flags (e.g., +r for registered)
  isAutoAway: false, // Whether the away status was set automatically due to inactivity
  watchLimit: 0, // WATCH limit from 005, 0 if not supported
  monitorLimit: 0, // MONITOR limit from 005, 0 if not supported
  silenceLimit: 0, // SILENCE limit from 005, 0 if not supported
  chatHistoryLimit: 0, // CHATHISTORY from 005 — most messages one request may ask for; 0 when unlimited or not advertised
  clientTagDeny: [] as string[], // CLIENTTAGDENY from 005 — client tags the server drops; `*` for all, `-tag` exempts one
  nickLenLimit: 50, // NICKLEN from 005
  lineLenLimit: 0, // LINELEN from 005 — max bytes the server accepts per line; 0 if not advertised, callers fall back to a conservative default
  networkName: undefined as string | undefined, // NETWORK from 005, overrides server.network for display
  lagMs: undefined as number | undefined, // Round-trip time of the last PING/PONG keepalive, undefined until measured
  currentUserAvatar: undefined as string | undefined, // Current user's avatar URL from metadata
  currentUserDisplayName: undefined as string | undefined,
  currentUserStatus: undefined as string | undefined,
  currentUserHomepage: undefined as string | undefined,
  currentUserColor: undefined as string | undefined,
});

type ConnectionState = ReturnType<typeof connectionDefaults>;

/** Kept across restarts */
interface SavedSession {
  /** None for the session before a network is chosen */
  server: Server | undefined;
  nick: string;
  wantedNick: string | undefined;
  currentChannelName: string;
  currentChannelCategory: ChannelCategory;
}

export type NetworkSession = SavedSession & ConnectionState;

const NO_SESSION: NetworkSession = {
  ...connectionDefaults(),
  server: undefined,
  nick: '',
  wantedNick: undefined,
  currentChannelName: 'Status',
  currentChannelCategory: ChannelCategory.status,
};

/** Whose session and data are those from before a network is chosen; they are never saved */
export const NO_NETWORK: NetworkId = '';

/** An older version kept the one network it knew in the settings */
const withLegacySettings = (storage: Storage): StateStorage => ({
  getItem: (name: string): string | null => storage.getItem(name) ?? legacyNetworksJson(),
  setItem: (name: string, value: string): void => {
    storage.setItem(name, value);
  },
  removeItem: (name: string): void => {
    storage.removeItem(name);
  },
});

interface NetworksStore {
  activeNetworkId: NetworkId | undefined;
  sessions: Record<NetworkId, NetworkSession>;

  /** Makes `server`'s network the active one for a new connection as `nick`; its saved session is picked up */
  activate: (server: Server, nick: string) => void;
  /** No network is active, e.g. while the user chooses another one */
  deactivate: () => void;
  /** Starts the network's session if it has none */
  updateSession: (networkId: NetworkId, patch: Partial<NetworkSession>) => void;
}

const savedFields = ({ server, nick, wantedNick, currentChannelName, currentChannelCategory }: NetworkSession): SavedSession => ({
  server,
  nick,
  wantedNick,
  currentChannelName,
  currentChannelCategory,
});

export const useNetworksStore = create<NetworksStore>()(
  devtools(
    persist(
      (set) => ({
        activeNetworkId: undefined,
        sessions: {},

        activate: (server: Server, nick: string): void => {
          const networkId = networkIdOf(server);
          set((state) => {
            const saved = state.sessions[networkId] ?? NO_SESSION;
            const started: NetworkSession = { ...saved, ...connectionDefaults(), server, nick };
            return { activeNetworkId: networkId, sessions: { ...state.sessions, [networkId]: started } };
          });
        },
        deactivate: (): void => {
          set(() => ({ activeNetworkId: undefined }));
        },
        updateSession: (networkId: NetworkId, patch: Partial<NetworkSession>): void => {
          set((state) => ({ sessions: { ...state.sessions, [networkId]: { ...(state.sessions[networkId] ?? NO_SESSION), ...patch } } }));
        },
      }),
      {
        name: 'sic-networks',
        version: 1,
        storage: createJSONStorage(() => withLegacySettings(localStorage)),
        partialize: (state) => ({
          activeNetworkId: state.activeNetworkId,
          sessions: Object.fromEntries(
            Object.entries(state.sessions)
              .filter(([networkId]) => networkId !== NO_NETWORK)
              .map(([networkId, session]) => [networkId, savedFields(session)]),
          ),
        }),
        // Nothing a connection learned outlives it
        merge: (persisted, current) => {
          const saved = persisted as { activeNetworkId?: NetworkId; sessions?: Record<NetworkId, SavedSession> } | undefined;
          return {
            ...current,
            activeNetworkId: saved?.activeNetworkId,
            sessions: Object.fromEntries(Object.entries(saved?.sessions ?? {}).map(([networkId, session]) => [networkId, { ...connectionDefaults(), ...session }])),
          };
        },
      },
    ),
    { name: 'networks' },
  ),
);

export const getActiveNetworkId = (): NetworkId => findActiveNetworkId() ?? NO_NETWORK;

/** None before a network is chosen */
export const findActiveNetworkId = (): NetworkId | undefined => useNetworksStore.getState().activeNetworkId;

const sessionOf = ({ activeNetworkId, sessions }: Pick<NetworksStore, 'activeNetworkId' | 'sessions'>): NetworkSession =>
  sessions[activeNetworkId ?? NO_NETWORK] ?? NO_SESSION;

export const getActiveSession = (): NetworkSession => sessionOf(useNetworksStore.getState());

const updateActiveSession = (patch: Partial<NetworkSession>): void => {
  useNetworksStore.getState().updateSession(getActiveNetworkId(), patch);
};

/** Re-renders when the active network changes, as well as when its session does */
export const useActiveSession = <T>(selector: (session: NetworkSession) => T): T => useNetworksStore((state) => selector(sessionOf(state)));

export const activateNetwork = (server: Server, nick: string): void => {
  useNetworksStore.getState().activate(server, nick);
};

export const deactivateNetwork = (): void => {
  useNetworksStore.getState().deactivate();
};

/** A new connection to the active network learns everything again */
export const resetConnectionSession = (): void => {
  updateActiveSession(connectionDefaults());
};

export const getServer = (): Server | undefined => getActiveSession().server;

export const getCurrentNick = (): string => getActiveSession().nick;

export const setNick = (newNick: string): void => {
  const session = getActiveSession();
  updateActiveSession({
    nick: newNick,
    // Metadata for the new nick arrives via METADATA
    ...(newNick !== session.nick
      ? {
          currentUserAvatar: undefined,
          currentUserDisplayName: undefined,
          currentUserStatus: undefined,
          currentUserHomepage: undefined,
          currentUserColor: undefined,
        }
      : {}),
  });
};

export const getWantedNick = (): string | undefined => getActiveSession().wantedNick;

export const setWantedNick = (nick: string | undefined): void => {
  updateActiveSession({ wantedNick: nick });
};

export const getIsConnected = (): boolean => getActiveSession().isConnected;

export const setIsConnected = (status: boolean): void => {
  updateActiveSession({ isConnected: status });
};

export const setIsConnecting = (status: boolean): void => {
  updateActiveSession({ isConnecting: status });
};

export const getConnectedTime = (): number => getActiveSession().connectedTime;

export const setConnectedTime = (time: number): void => {
  updateActiveSession({ connectedTime: time });
};

export const getCurrentChannelName = (): string => getActiveSession().currentChannelName;

export const getCurrentChannelCategory = (): ChannelCategory => getActiveSession().currentChannelCategory;

/** Only the session's record of it; setCurrentChannelName also shows the window */
export const setCurrentWindow = (channelName: string, category: ChannelCategory): void => {
  updateActiveSession({ currentChannelName: channelName, currentChannelCategory: category });
};

export const getUserModes = (): UserMode[] => getActiveSession().userModes;

export const setUserModes = (modes: UserMode[]): void => {
  updateActiveSession({ userModes: modes });
};

export const getChannelModes = (): ChannelMode => getActiveSession().channelModes;

export const setChannelModes = (modes: ChannelMode): void => {
  updateActiveSession({ channelModes: modes });
};

export const setListRequestRemainingSeconds = (seconds: number): void => {
  updateActiveSession({ listRequestRemainingSeconds: seconds });
};

export const getChannelTypes = (): string[] => {
  const { channelTypes } = getActiveSession();
  return channelTypes.length > 0 ? channelTypes : defaultChannelTypes;
};

export const setChannelTypes = (types: string[]): void => {
  updateActiveSession({ channelTypes: types });
};

export const getCaseMapping = (): CaseMapping => getActiveSession().caseMapping;

export const setCaseMapping = (mapping: CaseMapping): void => {
  updateActiveSession({ caseMapping: mapping });
};

/** Always use this instead of `===` when comparing IRC names. */
export const isSameName = (a: string, b: string): boolean => namesEqual(a, b, getCaseMapping());

export const isSupportedOption = (option: string): boolean => getActiveSession().supportedOptions.includes(option);

export const setSupportedOption = (option: string): void => {
  updateActiveSession({ supportedOptions: [...getActiveSession().supportedOptions, option] });
};

export const getCurrentUserFlags = (): string[] => getActiveSession().currentUserFlags;

export const setCurrentUserFlag = (flag: string, add: boolean): void => {
  const flags = getActiveSession().currentUserFlags;
  updateActiveSession({ currentUserFlags: add ? [...flags, flag] : flags.filter((existing) => existing !== flag) });
};

export const setIsAutoAway = (isAuto: boolean): void => {
  updateActiveSession({ isAutoAway: isAuto });
};

export const getWatchLimit = (): number => getActiveSession().watchLimit;

export const setWatchLimit = (limit: number): void => {
  updateActiveSession({ watchLimit: limit });
};

export const getMonitorLimit = (): number => getActiveSession().monitorLimit;

export const setMonitorLimit = (limit: number): void => {
  updateActiveSession({ monitorLimit: limit });
};

export const getSilenceLimit = (): number => getActiveSession().silenceLimit;

export const setSilenceLimit = (limit: number): void => {
  updateActiveSession({ silenceLimit: limit });
};

export const getChatHistoryLimit = (): number => getActiveSession().chatHistoryLimit;

export const setChatHistoryLimit = (limit: number): void => {
  updateActiveSession({ chatHistoryLimit: limit });
};

export const getClientTagDeny = (): string[] => getActiveSession().clientTagDeny;

export const setClientTagDeny = (tags: string[]): void => {
  updateActiveSession({ clientTagDeny: tags });
};

export const getNickLenLimit = (): number => getActiveSession().nickLenLimit;

export const setNickLenLimit = (limit: number): void => {
  updateActiveSession({ nickLenLimit: limit });
};

/** ISUPPORT `LINELEN`, or `0` if the server never sent one. */
export const getLineLenLimit = (): number => getActiveSession().lineLenLimit;

export const setLineLenLimit = (limit: number): void => {
  updateActiveSession({ lineLenLimit: limit });
};

export const setNetworkName = (name: string | undefined): void => {
  updateActiveSession({ networkName: name });
};

export const setLagMs = (lagMs: number | undefined): void => {
  updateActiveSession({ lagMs });
};

export const setCurrentUserAvatar = (avatar: string | undefined): void => {
  updateActiveSession({ currentUserAvatar: avatar });
};

export const setCurrentUserDisplayName = (displayName: string | undefined): void => {
  updateActiveSession({ currentUserDisplayName: displayName });
};

export const setCurrentUserStatus = (status: string | undefined): void => {
  updateActiveSession({ currentUserStatus: status });
};

export const setCurrentUserHomepage = (homepage: string | undefined): void => {
  updateActiveSession({ currentUserHomepage: homepage });
};

export const setCurrentUserColor = (color: string | undefined): void => {
  updateActiveSession({ currentUserColor: color });
};
