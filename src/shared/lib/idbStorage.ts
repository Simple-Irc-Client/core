import { get, set, del } from 'idb-keyval';
import { type NetworkId } from '@features/networks/networkId';

const WRITE_DEBOUNCE_MS = 2000;

export interface NetworkStorage<Saved> {
  /** What was saved for the network; nothing when unreadable too */
  load: (networkId: NetworkId) => Promise<Saved | undefined>;
  /** Like load, for a key an older version saved under */
  loadKey: (key: string) => Promise<Saved | undefined>;
  /** Debounced; serialized only when written */
  save: (networkId: NetworkId, value: Saved) => void;
  /** Written at once; resolves once it is */
  saveNow: (networkId: NetworkId, value: Saved) => Promise<void>;
  removeKey: (key: string) => Promise<void>;
  /** Only needed by tests; the app keeps one storage for its lifetime. */
  dispose: () => void;
}

const readKey = async <Saved>(key: string): Promise<Saved | undefined> => {
  let raw: unknown;
  try {
    raw = await get(key);
  } catch {
    // Private browsing or no IndexedDB: the app works without what was saved
    return undefined;
  }
  if (typeof raw !== 'string') {
    return undefined;
  }

  try {
    return JSON.parse(raw) as Saved;
  } catch (error) {
    // Truncated or hand-edited data: start clean rather than break the app
    console.warn('Failed to parse persisted state:', error);
    return undefined;
  }
};

/** One value per network in IndexedDB, under `baseName:networkId` */
export const createNetworkStorage = <Saved>(baseName: string): NetworkStorage<Saved> => {
  const keyOf = (networkId: NetworkId): string => `${baseName}:${networkId}`;
  const pendingValues = new Map<string, Saved>();
  const pendingWrites = new Map<string, ReturnType<typeof setTimeout>>();

  const write = async (key: string, value: Saved): Promise<void> => {
    let encoded: string;
    try {
      encoded = JSON.stringify(value);
    } catch (error) {
      // A value that cannot be encoded would throw on every later write too
      console.warn('Failed to serialize state for persistence:', error);
      return;
    }

    try {
      await set(key, encoded);
    } catch {
      // Private browsing or quota exceeded: the app works without persistence
    }
  };

  const cancel = (key: string): void => {
    clearTimeout(pendingWrites.get(key));
    pendingWrites.delete(key);
    pendingValues.delete(key);
  };

  // Fire-and-forget: it also runs during page teardown
  const flush = (key: string): void => {
    const value = pendingValues.get(key);
    cancel(key);
    if (value !== undefined) {
      void write(key, value);
    }
  };

  const flushAll = (): void => {
    for (const key of [...pendingValues.keys()]) {
      flush(key);
    }
  };

  // Flush pending writes on hide/pagehide: closed or discarded tabs may never get `unload`
  const onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') {
      flushAll();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
    globalThis.addEventListener('pagehide', flushAll);
  }

  return {
    load: (networkId: NetworkId) => readKey<Saved>(keyOf(networkId)),
    loadKey: (key: string) => readKey<Saved>(key),
    save: (networkId: NetworkId, value: Saved): void => {
      const key = keyOf(networkId);
      pendingValues.set(key, value);
      clearTimeout(pendingWrites.get(key));
      pendingWrites.set(key, setTimeout(() => flush(key), WRITE_DEBOUNCE_MS));
    },
    saveNow: (networkId: NetworkId, value: Saved): Promise<void> => {
      const key = keyOf(networkId);
      cancel(key);
      return write(key, value);
    },
    removeKey: async (key: string): Promise<void> => {
      // A queued write would otherwise resurrect what was just removed
      cancel(key);
      try {
        await del(key);
      } catch {
        // Same as a failed write
      }
    },
    dispose: (): void => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
        globalThis.removeEventListener('pagehide', flushAll);
      }
      for (const timer of pendingWrites.values()) {
        clearTimeout(timer);
      }
      pendingWrites.clear();
      pendingValues.clear();
    },
  };
};
