import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { get, set, del } from 'idb-keyval';
import { createServerScopedStorage } from '../idbStorage';

vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));

const WRITE_DEBOUNCE_MS = 2000;

interface TestState {
  value: string;
}

const settings = (network: string, servers: string[], index: number): string =>
  JSON.stringify({ state: { server: { network, servers, default: index } } });

describe('idbStorage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(get).mockResolvedValue(undefined);
    vi.mocked(set).mockResolvedValue(undefined);
    vi.mocked(del).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('storage key', () => {
    it('should scope the key to the network and the selected server', async () => {
      localStorage.setItem('sic-settings', settings('PIrc', ['a.pirc.pl', 'b.pirc.pl'], 1));
      const storage = createServerScopedStorage<TestState>();

      await storage.getItem('sic-channels');

      expect(vi.mocked(get)).toHaveBeenCalledWith('sic-channels:PIrc:b.pirc.pl');
    });

    it('should fall back to the bare name when no settings are stored', async () => {
      const storage = createServerScopedStorage<TestState>();

      await storage.getItem('sic-channels');

      expect(vi.mocked(get)).toHaveBeenCalledWith('sic-channels');
    });

    it('should fall back to the bare name when the settings are corrupt', async () => {
      localStorage.setItem('sic-settings', '{not json');
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const storage = createServerScopedStorage<TestState>();

      await storage.getItem('sic-channels');

      expect(vi.mocked(get)).toHaveBeenCalledWith('sic-channels');
    });
  });

  describe('getItem', () => {
    it('should parse the stored payload', async () => {
      vi.mocked(get).mockResolvedValue(JSON.stringify({ state: { value: 'hello' }, version: 2 }));
      const storage = createServerScopedStorage<TestState>();

      await expect(storage.getItem('sic-channels')).resolves.toEqual({ state: { value: 'hello' }, version: 2 });
    });

    it('should return null when nothing is stored', async () => {
      const storage = createServerScopedStorage<TestState>();

      await expect(storage.getItem('sic-channels')).resolves.toBeNull();
    });

    it('should return null instead of throwing on truncated data', async () => {
      vi.mocked(get).mockResolvedValue('{"state":{"value":"hel');
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const storage = createServerScopedStorage<TestState>();

      await expect(storage.getItem('sic-channels')).resolves.toBeNull();
    });

    it('should return null when IndexedDB is unavailable', async () => {
      vi.mocked(get).mockRejectedValue(new Error('private browsing'));
      const storage = createServerScopedStorage<TestState>();

      await expect(storage.getItem('sic-channels')).resolves.toBeNull();
    });
  });

  describe('setItem', () => {
    it('should not touch storage before the debounce elapses', () => {
      const storage = createServerScopedStorage<TestState>();

      storage.setItem('sic-channels', { state: { value: 'a' }, version: 2 });

      expect(vi.mocked(set)).not.toHaveBeenCalled();
    });

    it('should write the payload once the debounce elapses', async () => {
      const storage = createServerScopedStorage<TestState>();

      storage.setItem('sic-channels', { state: { value: 'a' }, version: 2 });
      await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);

      expect(vi.mocked(set)).toHaveBeenCalledExactlyOnceWith('sic-channels', JSON.stringify({ state: { value: 'a' }, version: 2 }));
    });

    it('should collapse a burst of updates into a single write of the last value', async () => {
      const storage = createServerScopedStorage<TestState>();

      for (const value of ['a', 'b', 'c']) {
        storage.setItem('sic-channels', { state: { value }, version: 2 });
      }
      await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);

      expect(vi.mocked(set)).toHaveBeenCalledExactlyOnceWith('sic-channels', JSON.stringify({ state: { value: 'c' }, version: 2 }));
    });

    it('should serialize only at flush time, so superseded states are never encoded', async () => {
      const storage = createServerScopedStorage<TestState>();
      let encoded = 0;
      const state = { get value() { encoded++; return 'a'; } };

      for (let i = 0; i < 10; i++) {
        storage.setItem('sic-channels', { state, version: 2 });
      }
      expect(encoded).toBe(0);

      await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);

      expect(encoded).toBe(1);
    });

    it('should keep working when the write fails', async () => {
      vi.mocked(set).mockRejectedValue(new Error('quota exceeded'));
      const storage = createServerScopedStorage<TestState>();

      storage.setItem('sic-channels', { state: { value: 'a' }, version: 2 });
      await expect(vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS)).resolves.not.toThrow();
    });

    it('should skip a value that cannot be serialized', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const storage = createServerScopedStorage<TestState>();
      const circular: Record<string, unknown> = {};
      circular.self = circular;

      storage.setItem('sic-channels', { state: circular as unknown as TestState, version: 2 });
      await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);

      expect(vi.mocked(set)).not.toHaveBeenCalled();
    });

    it('should write again after a flush', async () => {
      const storage = createServerScopedStorage<TestState>();

      storage.setItem('sic-channels', { state: { value: 'a' }, version: 2 });
      await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);
      storage.setItem('sic-channels', { state: { value: 'b' }, version: 2 });
      await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);

      expect(vi.mocked(set)).toHaveBeenCalledTimes(2);
      expect(vi.mocked(set)).toHaveBeenLastCalledWith('sic-channels', JSON.stringify({ state: { value: 'b' }, version: 2 }));
    });
  });

  describe('removeItem', () => {
    it('should delete the scoped key', async () => {
      localStorage.setItem('sic-settings', settings('PIrc', ['a.pirc.pl'], 0));
      const storage = createServerScopedStorage<TestState>();

      await storage.removeItem('sic-channels');

      expect(vi.mocked(del)).toHaveBeenCalledWith('sic-channels:PIrc:a.pirc.pl');
    });

    it('should drop a queued write so it cannot resurrect the removed data', async () => {
      const storage = createServerScopedStorage<TestState>();

      storage.setItem('sic-channels', { state: { value: 'a' }, version: 2 });
      await storage.removeItem('sic-channels');
      await vi.advanceTimersByTimeAsync(WRITE_DEBOUNCE_MS);

      expect(vi.mocked(set)).not.toHaveBeenCalled();
    });
  });
});
