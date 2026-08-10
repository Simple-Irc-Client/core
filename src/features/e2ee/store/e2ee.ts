/**
 * SIC-E2EE v1 — per-conversation session state (not persisted).
 *
 * This store holds only what the UI needs to render: which conversations are
 * encrypted, the fingerprints to show, and whether the user has verified them.
 * The actual key material deliberately lives *outside* zustand, in a module
 * private to `session.ts` — state here passes through the devtools middleware,
 * and secrets have no business being in a devtools timeline.
 *
 * Nothing is persisted. Session keys are ephemeral by design (that is what buys
 * forward secrecy), so there would be nothing worth restoring on reload.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { foldName } from '@shared/lib/caseMapping';
import { getCaseMapping } from '@/features/settings/store/settings';

export const E2eeState = {
  /** No encryption; the normal plaintext conversation. */
  none: 'none',
  /** We sent an OFFER and are waiting for the peer to answer. */
  offered: 'offered',
  /** The peer offered; waiting for the user to accept or decline. */
  incoming: 'incoming',
  /** Keys agreed, messages are encrypted. */
  active: 'active',
  /** The peer said no. Remembered so we don't nag. */
  declined: 'declined',
  /**
   * The peer's identity key differs from the one we pinned. This is the state
   * that matters: it is what an attempted key substitution looks like, so it
   * blocks rather than silently re-keying.
   */
  fingerprintChanged: 'fingerprintChanged',
  /** The handshake failed — malformed keys, an unsupported version, a crypto error. */
  error: 'error',
} as const;

export type E2eeState = (typeof E2eeState)[keyof typeof E2eeState];

export interface E2eeSession {
  /** Peer nick in display case. */
  peer: string;
  state: E2eeState;
  /** Our own fingerprint for this network, shown so the peer can check it too. */
  myFingerprint?: string;
  /** The peer's fingerprint, from the key they actually sent. */
  theirFingerprint?: string;
  /** The pinned fingerprint we expected, set only when `state` is `fingerprintChanged`. */
  expectedFingerprint?: string;
  /** True once the user confirmed the fingerprint out of band. */
  verified: boolean;
  /** Human-readable reason, shown in the banner when `state` is `error`. */
  errorMessage?: string;
}

interface E2eeStore {
  /** Keyed by IRC-folded nick. */
  sessions: Record<string, E2eeSession>;
  upsertSession: (key: string, session: E2eeSession) => void;
  patchSession: (key: string, patch: Partial<E2eeSession>) => void;
  removeSession: (key: string) => void;
  clearSessions: () => void;
}

export const useE2eeStore = create<E2eeStore>()(
  devtools(
    (set) => ({
      sessions: {},

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

      clearSessions: (): void => {
        set(() => ({ sessions: {} }));
      },
    }),
    { name: 'e2ee' },
  ),
);

/**
 * Map a nick to its session key using the server's own casemapping, so `Bob`
 * and `bob` — and `a[b]` and `a{b}` on an rfc1459 server — are one conversation.
 */
export const getSessionKey = (nick: string): string => foldName(nick, getCaseMapping());

// Helper functions for external use (the IRC kernel is not a React component)

export const getSession = (nick: string): E2eeSession | undefined =>
  useE2eeStore.getState().sessions[getSessionKey(nick)];

export const getSessionState = (nick: string): E2eeState => getSession(nick)?.state ?? E2eeState.none;

export const isSessionActive = (nick: string): boolean => getSessionState(nick) === E2eeState.active;

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
