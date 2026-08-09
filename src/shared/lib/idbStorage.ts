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
      // Silently fail
    }
  },
};

/**
 * Server-scoped IndexedDB persistence that defers *serialization*, not just the
 * write.
 *
 * `persist` calls its storage after every single store mutation, and zustand's
 * own `createJSONStorage` runs `JSON.stringify` right there — so with the write
 * debounced but the encoding not, every incoming message, typing indicator and
 * unread bump re-encoded the entire backlog of every open channel only for that
 * string to be thrown away by the next mutation. At 20 open channels that was
 * ~2 ms of blocked main thread per message.
 *
 * Taking `PersistStorage` instead of `StateStorage` means we are handed the
 * state object rather than a string, so the encoding can wait for the timer too
 * and only the snapshot that actually gets written is ever encoded. Holding the
 * object across the debounce window is safe because the stores it serves update
 * immutably — the captured graph is a snapshot, not a live view.
 */
export const createServerScopedStorage = <S>(): PersistStorage<S> => {
  let pendingWrite: ReturnType<typeof setTimeout> | null = null;
  let pendingValue: StorageValue<S> | null = null;
  let pendingKey: string | null = null;

  const flush = async (): Promise<void> => {
    pendingWrite = null;

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

    await idbStorage.setItem(key, encoded);
  };

  return {
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
      pendingWrite = setTimeout(() => void flush(), WRITE_DEBOUNCE_MS);
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
