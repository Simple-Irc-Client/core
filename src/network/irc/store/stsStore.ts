import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { STSPolicy } from '../sts';

interface STSStore {
  policies: Record<string, STSPolicy>; // Keyed by lowercase hostname

  setPolicy: (host: string, policy: STSPolicy) => void;
  getPolicy: (host: string) => STSPolicy | undefined;
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
