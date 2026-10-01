import { get, set, del } from 'idb-keyval';
import type { PersistStorage, StateStorage, StorageValue } from 'zustand/middleware';

const WRITE_DEBOUNCE_MS = 2000;

const getServerStorageKey = (baseName: string): string => {
  try {
    const settingsJson = localStorage.getItem('sic-settings');
    if (settingsJson) {
      const settings = JSON.parse(settingsJson) as { state?: { server?: { network: string; servers: string[]; default: number } } };
      const server = settings?.state?.server;
      if (server) {
        return `${baseName}:${server.network}:${server.servers[server.default]}`;
      }
    }
  } catch (error) {
    console.warn('Failed to parse settings for storage key:', error);
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
      // Same as setItem
    }
  },
};

// Debounces JSON serialization too, not just the write (createJSONStorage re-encoded everything per mutation).
// Holding the state object is safe because the stores update immutably
export const createServerScopedStorage = <S>(): PersistStorage<S> & { dispose: () => void } => {
  let pendingWrite: ReturnType<typeof setTimeout> | null = null;
  let pendingValue: StorageValue<S> | null = null;
  let pendingKey: string | null = null;

  // Fire-and-forget: it also runs during page teardown, and idbStorage never rejects
  const flush = (): void => {
    if (pendingWrite !== null) {
      clearTimeout(pendingWrite);
      pendingWrite = null;
    }

    const key = pendingKey;
    const value = pendingValue;
    pendingKey = null;
    pendingValue = null;

    if (key === null || value === null) {
      return;
    }

    let encoded: string;
    try {
      encoded = JSON.stringify(value);
    } catch (error) {
      // A value that cannot be encoded would throw on every later write too
      console.warn('Failed to serialize state for persistence:', error);
      return;
    }

    void idbStorage.setItem(key, encoded);
  };

  // Flush pending writes on hide/pagehide: closed or discarded tabs may never get `unload`
  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      flush();
    }
  };
  const onPageHide = (): void => {
    flush();
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
    globalThis.addEventListener('pagehide', onPageHide);
  }

  return {
    /** Only needed by tests; the app keeps one storage for its lifetime. */
    dispose: (): void => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        globalThis.removeEventListener('pagehide', onPageHide);
      }
      if (pendingWrite !== null) {
        clearTimeout(pendingWrite);
        pendingWrite = null;
      }
      pendingKey = null;
      pendingValue = null;
    },
    getItem: async (name: string): Promise<StorageValue<S> | null> => {
      const raw = await idbStorage.getItem(getServerStorageKey(name));
      if (raw === null) {
        return null;
      }

      try {
        return JSON.parse(raw) as StorageValue<S>;
      } catch (error) {
        // Truncated or hand-edited data: start clean rather than break the app
        console.warn('Failed to parse persisted state:', error);
        return null;
      }
    },
    setItem: (name: string, value: StorageValue<S>): void => {
      pendingKey = getServerStorageKey(name);
      pendingValue = value;

      if (pendingWrite !== null) {
        clearTimeout(pendingWrite);
      }
      pendingWrite = setTimeout(flush, WRITE_DEBOUNCE_MS);
    },
    removeItem: async (name: string): Promise<void> => {
      const key = getServerStorageKey(name);

      // A queued write would otherwise resurrect what was just removed
      if (pendingWrite !== null) {
        clearTimeout(pendingWrite);
        pendingWrite = null;
      }
      pendingKey = null;
      pendingValue = null;

      await idbStorage.removeItem(key);
    },
  };
};
