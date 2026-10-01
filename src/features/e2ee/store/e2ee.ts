// UI state only, never persisted. Key material stays in session.ts: this store passes through devtools

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { foldName } from '@shared/lib/caseMapping';
import { getCaseMapping } from '@/features/settings/store/settings';

export const E2eeState = {
  none: 'none',
  /** We sent an OFFER */
  offered: 'offered',
  /** The peer offered; the user decides */
  incoming: 'incoming',
  active: 'active',
  /** Remembered so we don't nag */
  declined: 'declined',
  /** Identity key differs from the pin: blocks, never silently re-keys */
  fingerprintChanged: 'fingerprintChanged',
  error: 'error',
} as const;

export type E2eeState = (typeof E2eeState)[keyof typeof E2eeState];

export interface E2eeSession {
  peer: string;
  state: E2eeState;
  myFingerprint?: string;
  theirFingerprint?: string;
  /** Only when `fingerprintChanged` */
  expectedFingerprint?: string;
  verified: boolean;
  /** Only when `error` */
  errorMessage?: string;
}

interface E2eeStore {
  /** Keyed by IRC-folded nick. */
  sessions: Record<string, E2eeSession>;
  /** Silences the downgrade warning; reset on disconnect, not a standing decision. Keyed by folded nick */
  plaintextAcknowledged: Record<string, boolean>;
  upsertSession: (key: string, session: E2eeSession) => void;
  patchSession: (key: string, patch: Partial<E2eeSession>) => void;
  removeSession: (key: string) => void;
  setPlaintextAcknowledged: (key: string, acknowledged: boolean) => void;
  clearSessions: () => void;
}

export const useE2eeStore = create<E2eeStore>()(
  devtools(
    (set) => ({
      sessions: {},
      plaintextAcknowledged: {},

      upsertSession: (key: string, session: E2eeSession): void => {
        set((state) => ({ sessions: { ...state.sessions, [key]: session } }));
      },

      patchSession: (key: string, patch: Partial<E2eeSession>): void => {
        set((state) => {
          const existing = state.sessions[key];
          if (!existing) {
            return state;
          }
          return { sessions: { ...state.sessions, [key]: { ...existing, ...patch } } };
        });
      },

      removeSession: (key: string): void => {
        set((state) => {
          if (!(key in state.sessions)) {
            return state;
          }
          return { sessions: Object.fromEntries(Object.entries(state.sessions).filter(([entry]) => entry !== key)) };
        });
      },

      setPlaintextAcknowledged: (key: string, acknowledged: boolean): void => {
        set((state) => {
          if ((state.plaintextAcknowledged[key] ?? false) === acknowledged) {
            return state;
          }
          if (!acknowledged) {
            return {
              plaintextAcknowledged: Object.fromEntries(
                Object.entries(state.plaintextAcknowledged).filter(([entry]) => entry !== key),
              ),
            };
          }
          return { plaintextAcknowledged: { ...state.plaintextAcknowledged, [key]: true } };
        });
      },

      clearSessions: (): void => {
        set(() => ({ sessions: {}, plaintextAcknowledged: {} }));
      },
    }),
    { name: 'e2ee' },
  ),
);

/** Server casemapping, so `Bob`/`bob` (and `a[b]`/`a{b}` on rfc1459) are one conversation. */
export const getSessionKey = (nick: string): string => foldName(nick, getCaseMapping());

export const getSession = (nick: string): E2eeSession | undefined =>
  useE2eeStore.getState().sessions[getSessionKey(nick)];

export const getSessionState = (nick: string): E2eeState => getSession(nick)?.state ?? E2eeState.none;

export const isSessionActive = (nick: string): boolean => getSessionState(nick) === E2eeState.active;

export const getActiveSessionPeers = (): string[] =>
  Object.values(useE2eeStore.getState().sessions)
    .filter((session) => session.state === E2eeState.active)
    .map((session) => session.peer);

export const setSession = (nick: string, session: Omit<E2eeSession, 'peer'>): void => {
  useE2eeStore.getState().upsertSession(getSessionKey(nick), { ...session, peer: nick });
};

export const patchSession = (nick: string, patch: Partial<E2eeSession>): void => {
  useE2eeStore.getState().patchSession(getSessionKey(nick), patch);
};

export const removeSession = (nick: string): void => {
  useE2eeStore.getState().removeSession(getSessionKey(nick));
};

export const clearSessions = (): void => {
  useE2eeStore.getState().clearSessions();
};

export const setPlaintextAcknowledged = (nick: string, acknowledged: boolean): void => {
  useE2eeStore.getState().setPlaintextAcknowledged(getSessionKey(nick), acknowledged);
};

export const isPlaintextAcknowledged = (nick: string): boolean =>
  useE2eeStore.getState().plaintextAcknowledged[getSessionKey(nick)] === true;
