/**
 * STS Policy Store
 *
 * Persists STS policies to localStorage so they survive browser restarts.
 * Per IRCv3 spec, clients must remember STS policies for the duration specified.
 */

import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import type { STSPolicy } from '../sts';

interface STSStore {
  policies: Record<string, STSPolicy>; // Keyed by lowercase hostname

  // Actions
  setPolicy: (host: string, policy: STSPolicy) => void;
  getPolicy: (host: string) => STSPolicy | undefined;
  removePolicy: (host: string) => void;
  removeExpiredPolicies: () => void;
  hasValidPolicy: (host: string) => boolean;
  clearAllPolicies: () => void;
}

export const useSTSStore = create<STSStore>()(
  devtools(
    persist(
      (set, get) => ({
        policies: {},

        setPolicy: (host: string, policy: STSPolicy) =>
          set(
            (state) => ({
              policies: { ...state.policies, [host.toLowerCase()]: policy },
            }),
            false,
            'setPolicy'
          ),

        getPolicy: (host: string) => get().policies[host.toLowerCase()],

        removePolicy: (host: string) =>
          set(
            (state) => {
              const key = host.toLowerCase();
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { [key]: _removed, ...newPolicies } = state.policies;
              return { policies: newPolicies };
            },
            false,
            'removePolicy'
          ),

        removeExpiredPolicies: () =>
          set(
            (state) => {
              const now = Date.now();
              const validPolicies: Record<string, STSPolicy> = {};
              for (const [host, policy] of Object.entries(state.policies)) {
                // expiresAt=0 means indefinite (never expires)
                if (policy.expiresAt === 0 || policy.expiresAt > now) {
                  validPolicies[host] = policy;
                }
              }
              return { policies: validPolicies };
            },
            false,
            'removeExpiredPolicies'
          ),

        hasValidPolicy: (host: string) => {
          const policy = get().policies[host.toLowerCase()];
          if (!policy) return false;
          // expiresAt=0 means indefinite (always valid)
          return policy.expiresAt === 0 || policy.expiresAt > Date.now();
        },

        clearAllPolicies: () => set({ policies: {} }, false, 'clearAllPolicies'),
      }),
      {
        name: 'sic-sts-policies',
        storage: createJSONStorage(() => localStorage),
        version: 1,
      }
    ),
    { name: 'STSStore' }
  )
);

// ============================================================================
// Exported helper functions for non-React contexts
// ============================================================================

/**
 * Get STS policy for a host
 */
export const getSTSPolicy = (host: string): STSPolicy | undefined =>
  useSTSStore.getState().getPolicy(host);

/**
 * Set STS policy for a host
 */
export const setSTSPolicy = (host: string, policy: STSPolicy): void =>
  useSTSStore.getState().setPolicy(host, policy);

/**
 * Check if a valid STS policy exists for a host
 */
export const hasValidSTSPolicy = (host: string): boolean =>
  useSTSStore.getState().hasValidPolicy(host);

/**
 * Remove expired STS policies
 */
export const removeExpiredSTSPolicies = (): void =>
  useSTSStore.getState().removeExpiredPolicies();

/**
 * Remove STS policy for a host
 */
export const removeSTSPolicy = (host: string): void =>
  useSTSStore.getState().removePolicy(host);
