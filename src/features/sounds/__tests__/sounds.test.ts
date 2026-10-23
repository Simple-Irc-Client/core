import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type SoundsModule = typeof import('../sounds');
type SettingsModule = typeof import('@features/settings/store/settings');

interface FakeOscillator {
  frequency: { value: number };
  start: ReturnType<typeof vi.fn<(when?: number) => void>>;
}

let oscillators: FakeOscillator[];
let peakGains: number[];
let resume: ReturnType<typeof vi.fn<(context: FakeAudioContext) => Promise<void>>>;
let contextsCreated: number;

class FakeAudioContext {
  state = 'suspended';
  currentTime = 0;
  destination = {};

  constructor() {
    contextsCreated += 1;
  }

  resume(): Promise<void> {
    return resume(this);
  }

  createOscillator() {
    const oscillator = { frequency: { value: 0 }, connect: (node: unknown) => node, start: vi.fn<(when?: number) => void>(), stop: vi.fn() };
    oscillators.push(oscillator);
    return oscillator;
  }

  createGain() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: (value: number) => peakGains.push(value),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: (node: unknown) => node,
    };
  }
}

describe('sounds', () => {
  let sounds: SoundsModule;
  let settings: SettingsModule;

  beforeEach(async () => {
    oscillators = [];
    peakGains = [];
    contextsCreated = 0;
    resume = vi.fn((context: FakeAudioContext) => {
      context.state = 'running';
      return Promise.resolve();
    });
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-23T10:00:00Z'));
    vi.resetModules();
    sounds = await import('../sounds');
    settings = await import('@features/settings/store/settings');
    settings.useSettingsStore.setState({ directSound: 'chime', mentionSound: 'ping', soundVolume: 50, currentChannelName: '#other' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'userActivation');
  });

  const playedFrequencies = (): number[] => oscillators.map((oscillator) => oscillator.frequency.value);

  describe('playSound', () => {
    it('should play the tones of the sound, scaled by the volume', async () => {
      await sounds.playSound('chime', 50);

      expect(playedFrequencies()).toEqual([880, 1318.51]);
      expect(oscillators.every((oscillator) => oscillator.start.mock.calls.length === 1)).toBe(true);
      expect(peakGains).toEqual([0.2, 0.2]);
    });

    it('should cap the volume at 100', async () => {
      await sounds.playSound('ping', 250);

      expect(peakGains).toEqual([0.4]);
    });

    it('should reuse one audio context', async () => {
      await sounds.playSound('ping', 50);
      await sounds.playSound('trill', 50);

      expect(contextsCreated).toBe(1);
      expect(resume).toHaveBeenCalledTimes(1);
      expect(playedFrequencies()).toHaveLength(4);
    });

    it.each([
      ['off', 50],
      ['siren', 50],
      ['ping', 0],
      ['ping', Number.NaN],
    ])('should play nothing for %s at volume %s', async (sound, volume) => {
      await sounds.playSound(sound as 'off', volume);

      expect(oscillators).toEqual([]);
      expect(contextsCreated).toBe(0);
    });

    it('should play nothing before the user has interacted with the page', async () => {
      Object.defineProperty(navigator, 'userActivation', { configurable: true, value: { hasBeenActive: false } });

      await sounds.playSound('ping', 50);

      expect(contextsCreated).toBe(0);
    });

    it('should play nothing when the browser refuses to start audio', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      resume.mockRejectedValue(new Error('not allowed'));

      await sounds.playSound('ping', 50);

      expect(oscillators).toEqual([]);
      expect(warn).toHaveBeenCalledWith('[sounds] audio unavailable:', expect.any(Error));
    });

    it('should play nothing without Web Audio', async () => {
      vi.stubGlobal('AudioContext', undefined);

      await expect(sounds.playSound('ping', 50)).resolves.toBeUndefined();
      expect(oscillators).toEqual([]);
    });
  });

  describe('playHighlightSound', () => {
    const flush = (): Promise<void> => Promise.resolve().then(() => Promise.resolve());

    it('should play the private message sound for a DM, and the mention sound for a channel', async () => {
      sounds.playHighlightSound('friend', true);
      await flush();
      vi.setSystemTime(Date.now() + 1000);
      sounds.playHighlightSound('#channel', false);
      await flush();

      expect(playedFrequencies()).toEqual([880, 1318.51, 1567.98]);
    });

    it('should play nothing when that sound is off', async () => {
      settings.useSettingsStore.setState({ directSound: 'off' });

      sounds.playHighlightSound('friend', true);
      await flush();

      expect(oscillators).toEqual([]);
    });

    it('should play one sound for a burst of highlights', async () => {
      sounds.playHighlightSound('#channel', false);
      sounds.playHighlightSound('#channel', false);
      vi.setSystemTime(Date.now() + 999);
      sounds.playHighlightSound('friend', true);
      await flush();

      expect(playedFrequencies()).toEqual([1567.98]);
    });

    it('should play nothing for the conversation the user is looking at', async () => {
      settings.useSettingsStore.setState({ currentChannelName: '#Channel' });
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);

      sounds.playHighlightSound('#channel', false);
      await flush();

      expect(oscillators).toEqual([]);
    });

    it('should play for the open conversation while the app is in the background', async () => {
      settings.useSettingsStore.setState({ currentChannelName: '#channel' });
      vi.spyOn(document, 'hasFocus').mockReturnValue(false);

      sounds.playHighlightSound('#channel', false);
      await flush();

      expect(playedFrequencies()).toEqual([1567.98]);
    });

    it('should play for the open conversation while the tab is hidden', async () => {
      settings.useSettingsStore.setState({ currentChannelName: '#channel' });
      vi.spyOn(document, 'hasFocus').mockReturnValue(true);
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

      sounds.playHighlightSound('#channel', false);
      await flush();

      expect(playedFrequencies()).toEqual([1567.98]);
    });
  });
});
