import { get, set, del } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';
import { useSettingsStore } from '@features/settings/store/settings';

const WRITE_DEBOUNCE_MS = 2000;

const getServerStorageKey = (baseName: string): string => {
  const server = useSettingsStore.getState().server;
  if (server) {
    return `${baseName}:${server.network}:${server.servers[server.default]}`;
  }
  return baseName;
};

const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return (await get(name)) ?? null;
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await set(name, value);
    } catch {
      // Silently fail — app works without persistence (private browsing, quota exceeded)
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await del(name);
    } catch {
      // Silently fail
    }
  },
};

export const createServerScopedStorage = (baseName: string): StateStorage => {
  let pendingWrite: ReturnType<typeof setTimeout> | null = null;
  let pendingValue: string | null = null;
  let pendingKey: string | null = null;

  return {
    getItem: async (name: string): Promise<string | null> => {
      const key = getServerStorageKey(name);
      return idbStorage.getItem(key);
    },
    setItem: async (name: string, value: string): Promise<void> => {
      pendingKey = getServerStorageKey(name);
      pendingValue = value;

      if (pendingWrite !== null) {
        clearTimeout(pendingWrite);
      }
      pendingWrite = setTimeout(() => {
        pendingWrite = null;
        if (pendingValue !== null && pendingKey !== null) {
          void idbStorage.setItem(pendingKey, pendingValue);
        }
      }, WRITE_DEBOUNCE_MS);
    },
    removeItem: async (name: string): Promise<void> => {
      const key = getServerStorageKey(name);
      if (pendingWrite !== null) {
        clearTimeout(pendingWrite);
        pendingWrite = null;
      }
      await idbStorage.removeItem(key);
    },
  };
};
