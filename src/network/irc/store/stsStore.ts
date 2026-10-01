import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { STSPolicy } from '../sts';

interface STSStore {
  policies: Record<string, STSPolicy>; // Keyed by lowercase hostname

  setPolicy: (host: string, policy: STSPolicy) => void;
  getPolicy: (host: string) => STSPolicy | undefined;
  removePolicy: (host: string) => void;
  removeExpiredPolicies: () => void;
  hasValidPolicy: (host: string) => boolean;
  clearAllPolicies: () => void;
}

// Session-only: persisted policies went stale and broke connecting on startup
export const useSTSStore = create<STSStore>()(
  devtools(
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
        if (!policy) { return false; }
        return policy.expiresAt === 0 || policy.expiresAt > Date.now();
      },

      clearAllPolicies: () => set({ policies: {} }, false, 'clearAllPolicies'),
    }),
    { name: 'STSStore' }
  )
);

export const getSTSPolicy = (host: string): STSPolicy | undefined =>
  useSTSStore.getState().getPolicy(host);

export const setSTSPolicy = (host: string, policy: STSPolicy): void =>
  useSTSStore.getState().setPolicy(host, policy);

export const hasValidSTSPolicy = (host: string): boolean =>
  useSTSStore.getState().hasValidPolicy(host);

export const removeExpiredSTSPolicies = (): void =>
  useSTSStore.getState().removeExpiredPolicies();

export const removeSTSPolicy = (host: string): void =>
  useSTSStore.getState().removePolicy(host);
