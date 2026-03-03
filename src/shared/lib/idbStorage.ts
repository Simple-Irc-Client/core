import { get, set, del } from 'idb-keyval';
import type { StateStorage } from 'zustand/middleware';

const WRITE_DEBOUNCE_MS = 2000;

const getServerStorageKey = async (baseName: string): Promise<string> => {
  // Lazy import to avoid circular dependency: channels → idbStorage → settings → channels
  const { useSettingsStore } = await import('@features/settings/store/settings');
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

export const createServerScopedStorage = (): StateStorage => {
  let pendingWrite: ReturnType<typeof setTimeout> | null = null;
  let pendingValue: string | null = null;
  let pendingKey: string | null = null;

  return {
    getItem: async (name: string): Promise<string | null> => {
      const key = await getServerStorageKey(name);
      return idbStorage.getItem(key);
    },
    setItem: async (name: string, value: string): Promise<void> => {
      pendingKey = await getServerStorageKey(name);
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
      const key = await getServerStorageKey(name);
      if (pendingWrite !== null) {
        clearTimeout(pendingWrite);
        pendingWrite = null;
      }
      await idbStorage.removeItem(key);
    },
  };
};
