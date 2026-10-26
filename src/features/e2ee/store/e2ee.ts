// UI state only, never persisted. Key material stays in session.ts: this store passes through devtools

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { foldName } from '@shared/lib/caseMapping';
import { getCaseMapping } from '@features/networks/store/networks';
import { activeSlice, updateActiveSlice, useActiveSlice, type NetworkSlices } from '@features/networks/store/networkSlices';

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

interface E2eeSlice {
  /** Keyed by IRC-folded nick. */
  sessions: Record<string, E2eeSession>;
  /** Silences the downgrade warning; reset on disconnect, not a standing decision. Keyed by folded nick */
  plaintextAcknowledged: Record<string, boolean>;
}

const NO_E2EE: E2eeSlice = { sessions: {}, plaintextAcknowledged: {} };

interface E2eeStore extends NetworkSlices<E2eeSlice> {  upsertSession: (key: string, session: E2eeSession) => void;
  patchSession: (key: string, patch: Partial<E2eeSession>) => void;
  removeSession: (key: string) => void;
  setPlaintextAcknowledged: (key: string, acknowledged: boolean) => void;
  clearSessions: () => void;
}

export const useE2eeStore = create<E2eeStore>()(
  devtools(
    (set) => ({
      byNetwork: {},
      emptySlice: NO_E2EE,

      upsertSession: (key: string, session: E2eeSession): void => {
        set((state) => updateActiveSlice(state, (slice) => ({ sessions: { ...slice.sessions, [key]: session } })));
      },

      patchSession: (key: string, patch: Partial<E2eeSession>): void => {
        set((state) => updateActiveSlice(state, (slice) => {
          const existing = slice.sessions[key];
          if (!existing) {
            return slice;
          }
          return { sessions: { ...slice.sessions, [key]: { ...existing, ...patch } } };
        }));
      },

      removeSession: (key: string): void => {
        set((state) => updateActiveSlice(state, (slice) => {
          if (!(key in slice.sessions)) {
            return slice;
          }
          return { sessions: Object.fromEntries(Object.entries(slice.sessions).filter(([entry]) => entry !== key)) };
        }));
      },

      setPlaintextAcknowledged: (key: string, acknowledged: boolean): void => {
        set((state) => updateActiveSlice(state, (slice) => {
          if ((slice.plaintextAcknowledged[key] ?? false) === acknowledged) {
            return slice;
          }
          if (!acknowledged) {
            return {
              plaintextAcknowledged: Object.fromEntries(
                Object.entries(slice.plaintextAcknowledged).filter(([entry]) => entry !== key),
              ),
            };
          }
          return { plaintextAcknowledged: { ...slice.plaintextAcknowledged, [key]: true } };
        }));
      },

      clearSessions: (): void => {
        set((state) => updateActiveSlice(state, () => NO_E2EE));
      },
    }),
    { name: 'e2ee' },
  ),
);

/** The active network's encryption sessions */
export const useActiveE2ee = <T>(selector: (slice: E2eeSlice) => T): T => useActiveSlice(useE2eeStore, selector);

const getE2ee = (): E2eeSlice => activeSlice(useE2eeStore.getState());

/** Server casemapping, so `Bob`/`bob` (and `a[b]`/`a{b}` on rfc1459) are one conversation. */
export const getSessionKey = (nick: string): string => foldName(nick, getCaseMapping());

export const getSession = (nick: string): E2eeSession | undefined =>
  getE2ee().sessions[getSessionKey(nick)];

export const getSessionState = (nick: string): E2eeState => getSession(nick)?.state ?? E2eeState.none;

export const isSessionActive = (nick: string): boolean => getSessionState(nick) === E2eeState.active;

export const getActiveSessionPeers = (): string[] =>
  Object.values(getE2ee().sessions)
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
  getE2ee().plaintextAcknowledged[getSessionKey(nick)] === true;
