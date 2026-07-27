/**
 * DCC store.
 *
 * Two slices with deliberately different lifetimes:
 *  - `settings` is persisted (plain localStorage via zustand `persist`, same as
 *    the friends store) because it is user configuration, not per-network state.
 *  - `sessions` is runtime only. A half-finished transfer cannot survive a
 *    reload — the socket is gone — so rehydrating one would only ever show a
 *    stale, un-cancellable row.
 */
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { DEFAULT_MAX_FILE_SIZE } from '../protocol';
import { DccStatus, type DccSession } from '../types';

export interface DccSettings {
  /** Master switch. When false, every inbound offer is declined silently. */
  enabled: boolean;
  /** Absolute download directory; null means "ask the OS for Downloads". */
  downloadDirectory: string | null;
  /** Refuse SEND offers announcing more than this */
  maxFileSize: number;
  /** Inclusive range the listener binds inside, for users who port-forward */
  portRangeStart: number;
  portRangeEnd: number;
  /**
   * Address to advertise in outgoing offers. Behind NAT the socket's local
   * address is a private one the peer cannot reach, so the user has to supply
   * their external IP — the same knob mIRC exposes. null means "use the local
   * address the OS picked".
   */
  advertisedHost: string | null;
  /** Accept offers pointing at RFC1918/loopback peers (LAN transfers) */
  allowPrivateAddress: boolean;
  /** Refuse the non-TLS CHAT/SEND variants entirely */
  secureOnly: boolean;
}

export const DEFAULT_DCC_SETTINGS: DccSettings = {
  enabled: true,
  downloadDirectory: null,
  maxFileSize: DEFAULT_MAX_FILE_SIZE,
  // 0 means "let the OS pick an ephemeral port", which is right unless the user
  // is behind a router they configured a specific forwarded range on.
  portRangeStart: 0,
  portRangeEnd: 0,
  advertisedHost: null,
  allowPrivateAddress: false,
  secureOnly: false,
};

interface DccSettingsStore {
  settings: DccSettings;
  setDccSettings: (patch: Partial<DccSettings>) => void;
}

export const useDccSettingsStore = create<DccSettingsStore>()(
  devtools(
    persist(
      (set) => ({
        settings: DEFAULT_DCC_SETTINGS,

        setDccSettings: (patch: Partial<DccSettings>): void => {
          set((state) => ({ settings: { ...state.settings, ...patch } }));
        },
      }),
      {
        name: 'sic-dcc',
        version: 1,
        // Merge rather than replace so a settings key added in a later release
        // gets its default instead of `undefined` on an existing install.
        merge: (persisted, current) => {
          const saved = (persisted as Partial<DccSettingsStore> | undefined)?.settings;
          return { ...current, settings: { ...DEFAULT_DCC_SETTINGS, ...saved } };
        },
      },
    ),
    { name: 'DccSettingsStore' },
  ),
);

export const getDccSettings = (): DccSettings => useDccSettingsStore.getState().settings;

interface DccSessionsStore {
  sessions: DccSession[];
  addDccSession: (session: DccSession) => void;
  updateDccSession: (id: string, patch: Partial<DccSession>) => void;
  removeDccSession: (id: string) => void;
  /** Drop every finished row, keeping in-flight ones */
  clearFinishedDccSessions: () => void;
}

const FINISHED: readonly DccSession['status'][] = [
  DccStatus.completed,
  DccStatus.failed,
  DccStatus.declined,
  DccStatus.cancelled,
];

export const useDccSessionsStore = create<DccSessionsStore>()(
  devtools(
    (set) => ({
      sessions: [],

      addDccSession: (session: DccSession): void => {
        set((state) => ({ sessions: [...state.sessions, session] }));
      },

      updateDccSession: (id: string, patch: Partial<DccSession>): void => {
        set((state) => {
          const index = state.sessions.findIndex((session) => session.id === id);
          if (index === -1) {
            return state;
          }
          const sessions = [...state.sessions];
          sessions[index] = { ...sessions[index] as DccSession, ...patch, updatedAt: Date.now() };
          return { sessions };
        });
      },

      removeDccSession: (id: string): void => {
        set((state) => ({ sessions: state.sessions.filter((session) => session.id !== id) }));
      },

      clearFinishedDccSessions: (): void => {
        set((state) => ({
          sessions: state.sessions.filter((session) => !FINISHED.includes(session.status)),
        }));
      },
    }),
    { name: 'DccSessionsStore' },
  ),
);

export const getDccSession = (id: string): DccSession | undefined =>
  useDccSessionsStore.getState().sessions.find((session) => session.id === id);

export const getDccSessionByChannel = (channelName: string): DccSession | undefined =>
  useDccSessionsStore
    .getState()
    .sessions.find((session) => session.channelName === channelName);

export const isDccFinished = (status: DccSession['status']): boolean => FINISHED.includes(status);
