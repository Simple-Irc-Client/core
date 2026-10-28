import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { get, set, del } from 'idb-keyval';
import { createNetworkStorage } from '../idbStorage';

vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));

const WRITE_DEBOUNCE_MS = 2000;

interface TestState {
  value: string;
}

interface Saved {
  state: TestState;
  version: number;
}

describe('idbStorage', () => {
  const created: { dispose: () => void }[] = [];

  /** Tracked so no test inherits another's page listeners or queued write */
  const createStorage = () => {
    const storage = createNetworkStorage<Saved>('sic-channels');
    created.push(storage);
    return storage;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(get).mockResolvedValue(undefined);
    vi.mocked(set).mockResolvedValue(undefined);
    vi.mocked(del).mockResolvedValue(undefined);
  });

  afterEach(() => {
    for (const storage of created.splice(0)) {
      storage.dispose();
    }
    vi.useRealTimers();
  });

  describe('keys', () => {
    it('should keep each network under its own key', async () => {
      const storage = createStorage();

      await storage.load('Libera.Chat');
      await storage.load('soju/bouncer:3');

      expect(vi.mocked(get)).toHaveBeenNthCalledWith(1, 'sic-channels:Libera.Chat');
      expect(vi.mocked(get)).toHaveBeenNthCalledWith(2, 'sic-channels:soju/bouncer:3');
    });

    it('should read a key an older version saved under', async () => {
      vi.mocked(get).mockResolvedValue(JSON.stringify({ state: { value: 'old' }, version: 2 }));
      const storage = createStorage();

      await expect(storage.loadKey('sic-channels:PIrc:a.pirc.pl')).resolves.toEqual({ state: { value: 'old' }, version: 2 });
      expect(vi.mocked(get)).toHaveBeenCalledWith('sic-channels:PIrc:a.pirc.pl');
    });

    it('should debounce each network on its own', async () => {
      const storage = createStorage();

      storage.save('A', { state: { value: 'a' }, version: 2 });
      storage.save('B', { state: { value: 'b' }, version: 2 });
      await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);

      expect(vi.mocked(set)).toHaveBeenCalledWith('sic-channels:A', JSON.stringify({ state: { value: 'a' }, version: 2 }));
      expect(vi.mocked(set)).toHaveBeenCalledWith('sic-channels:B', JSON.stringify({ state: { value: 'b' }, version: 2 }));
    });
  });

  describe('load', () => {
    it('should parse the stored payload', async () => {
      vi.mocked(get).mockResolvedValue(JSON.stringify({ state: { value: 'hello' }, version: 2 }));
      const storage = createStorage();

      await expect(storage.load('Net')).resolves.toEqual({ state: { value: 'hello' }, version: 2 });
    });

    it('should return nothing when nothing is stored', async () => {
      const storage = createStorage();

      await expect(storage.load('Net')).resolves.toBeUndefined();
    });

    it('should return nothing instead of throwing on truncated data', async () => {
      vi.mocked(get).mockResolvedValue('{"state":{"value":"hel');
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const storage = createStorage();

      await expect(storage.load('Net')).resolves.toBeUndefined();
    });

    it('should return nothing when IndexedDB is unavailable', async () => {
      vi.mocked(get).mockRejectedValue(new Error('private browsing'));
      const storage = createStorage();

      await expect(storage.load('Net')).resolves.toBeUndefined();
    });
  });

  describe('save', () => {
    it('should not touch storage before the debounce elapses', () => {
      const storage = createStorage();

      storage.save('Net', { state: { value: 'a' }, version: 2 });

      expect(vi.mocked(set)).not.toHaveBeenCalled();
    });

    it('should write the payload once the debounce elapses', async () => {
      const storage = createStorage();

      storage.save('Net', { state: { value: 'a' }, version: 2 });
      await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);

      expect(vi.mocked(set)).toHaveBeenCalledExactlyOnceWith('sic-channels:Net', JSON.stringify({ state: { value: 'a' }, version: 2 }));
    });

    it('should collapse a burst of updates into a single write of the last value', async () => {
      const storage = createStorage();

      for (const value of ['a', 'b', 'c']) {
        storage.save('Net', { state: { value }, version: 2 });
      }
      await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);

      expect(vi.mocked(set)).toHaveBeenCalledExactlyOnceWith('sic-channels:Net', JSON.stringify({ state: { value: 'c' }, version: 2 }));
    });

    it('should serialize only at flush time, so superseded states are never encoded', async () => {
      const storage = createStorage();
      let encoded = 0;
      const state = { get value() { encoded++; return 'a'; } };

      for (let i = 0; i < 10; i++) {
        storage.save('Net', { state, version: 2 });
      }
      expect(encoded).toBe(0);

      await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);

      expect(encoded).toBe(1);
    });

    it('should keep working when the write fails', async () => {
      vi.mocked(set).mockRejectedValue(new Error('quota exceeded'));
      const storage = createStorage();

      storage.save('Net', { state: { value: 'a' }, version: 2 });
      await expect(vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS)).resolves.not.toThrow();
    });

    it('should skip a value that cannot be serialized', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const storage = createStorage();
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      storage.save('Net', { state: circular as unknown as TestState, version: 2 });
      await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);

      expect(vi.mocked(set)).not.toHaveBeenCalled();
    });

    it('should write again after a flush', async () => {
      const storage = createStorage();

      storage.save('Net', { state: { value: 'a' }, version: 2 });
      await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);
      storage.save('Net', { state: { value: 'b' }, version: 2 });
      await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);

      expect(vi.mocked(set)).toHaveBeenCalledTimes(2);
      expect(vi.mocked(set)).toHaveBeenLastCalledWith('sic-channels:Net', JSON.stringify({ state: { value: 'b' }, version: 2 }));
    });
  });

  describe('flush before the page goes away', () => {
    const setVisibility = (state: 'visible' | 'hidden'): void => {
      Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    };

    it('should write a queued snapshot when the page is hidden', () => {
      const storage = createStorage();

      storage.save('Net', { state: { value: 'a' }, version: 2 });
      setVisibility('hidden');

      expect(vi.mocked(set)).toHaveBeenCalledExactlyOnceWith('sic-channels:Net', JSON.stringify({ state: { value: 'a' }, version: 2 }));
    });

    it('should not write again when the debounce would have fired', async () => {
      const storage = createStorage();

      storage.save('Net', { state: { value: 'a' }, version: 2 });
      setVisibility('hidden');
      await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);

      expect(vi.mocked(set)).toHaveBeenCalledTimes(1);
    });

    it('should ignore the page becoming visible', () => {
      const storage = createStorage();

      storage.save('Net', { state: { value: 'a' }, version: 2 });
      setVisibility('visible');

      expect(vi.mocked(set)).not.toHaveBeenCalled();
    });

    it('should do nothing when hidden with no queued write', () => {
      createStorage();

      setVisibility('hidden');

      expect(vi.mocked(set)).not.toHaveBeenCalled();
    });

    it('should write a queued snapshot on pagehide', () => {
      const storage = createStorage();

      storage.save('Net', { state: { value: 'a' }, version: 2 });
      globalThis.dispatchEvent(new Event('pagehide'));

      expect(vi.mocked(set)).toHaveBeenCalledExactlyOnceWith('sic-channels:Net', JSON.stringify({ state: { value: 'a' }, version: 2 }));
    });

    it('should keep persisting normally after a hidden flush', async () => {
      const storage = createStorage();

      storage.save('Net', { state: { value: 'a' }, version: 2 });
      setVisibility('hidden');
      setVisibility('visible');
      storage.save('Net', { state: { value: 'b' }, version: 2 });
      await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);

      expect(vi.mocked(set)).toHaveBeenCalledTimes(2);
      expect(vi.mocked(set)).toHaveBeenLastCalledWith('sic-channels:Net', JSON.stringify({ state: { value: 'b' }, version: 2 }));
    });
  });

  describe('saveNow', () => {
    it('should write at once, instead of a queued write', async () => {
      const storage = createStorage();

      storage.save('Net', { state: { value: 'queued' }, version: 2 });
      await storage.saveNow('Net', { state: { value: 'now' }, version: 2 });
      await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);

      expect(vi.mocked(set)).toHaveBeenCalledExactlyOnceWith('sic-channels:Net', JSON.stringify({ state: { value: 'now' }, version: 2 }));
    });
  });

  describe('removeKey', () => {
    it('should delete the key', async () => {
      const storage = createStorage();

      await storage.removeKey('sic-channels:PIrc:a.pirc.pl');

      expect(vi.mocked(del)).toHaveBeenCalledWith('sic-channels:PIrc:a.pirc.pl');
    });

    it('should drop a queued write so it cannot resurrect the removed data', async () => {
      const storage = createStorage();

      storage.save('Net', { state: { value: 'a' }, version: 2 });
      await storage.removeKey('sic-channels:Net');
      await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);

      expect(vi.mocked(set)).not.toHaveBeenCalled();
    });

    it('should keep working when the delete fails', async () => {
      vi.mocked(del).mockRejectedValue(new Error('private browsing'));
      const storage = createStorage();

      await expect(storage.removeKey('sic-channels:Net')).resolves.toBeUndefined();
    });
  });
});
