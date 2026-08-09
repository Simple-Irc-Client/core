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
export const createServerScopedStorage = <S>(): PersistStorage<S> & { dispose: () => void } => {
  let pendingWrite: ReturnType<typeof setTimeout> | null = null;
  let pendingValue: StorageValue<S> | null = null;
  let pendingKey: string | null = null;

  /**
   * Deliberately fire-and-forget: the write also has to run while the page is
   * being torn down, where there is nothing left to await into. `idbStorage`
   * swallows its own failures, so the promise never rejects.
   */
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

  /**
   * Without this, closing or navigating away within the debounce window drops
   * whatever arrived in the last couple of seconds — exactly the messages the
   * user just read.
   *
   * `visibilitychange` to hidden is the last event a page is reliably given:
   * a tab that gets closed, discarded under memory pressure, or backgrounded on
   * mobile may never see `unload`, and `beforeunload` is skipped there too.
   * `pagehide` covers navigating away within the same tab, including into the
   * back/forward cache. Both can fire for one teardown, but a flush with an
   * empty queue is a no-op, so the duplicate costs nothing.
   */
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
    /**
     * Detach from the page. The app holds a single storage for its whole
     * lifetime and never needs this, but a listener with no way off the page is
     * a leak waiting to happen — and tests need to not inherit each other's.
     */
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
