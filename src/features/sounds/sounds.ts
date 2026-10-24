// Synthesized with Web Audio, so no audio files ship with the app
import { getCurrentChannelName, getDirectSound, getMentionSound, getSoundVolume, isSameName } from '@features/settings/store/settings';

export const NOTIFICATION_SOUNDS = ['chime', 'ping', 'trill'] as const;

export type NotificationSound = (typeof NOTIFICATION_SOUNDS)[number] | 'off';

interface Tone {
  frequency: number;
  /** Seconds from the start of the sound */
  start: number;
  duration: number;
}

const TONES: Record<(typeof NOTIFICATION_SOUNDS)[number], Tone[]> = {
  chime: [
    { frequency: 880, start: 0, duration: 0.18 },
    { frequency: 1318.51, start: 0.12, duration: 0.3 },
  ],
  ping: [{ frequency: 1567.98, start: 0, duration: 0.25 }],
  trill: [
    { frequency: 523.25, start: 0, duration: 0.09 },
    { frequency: 659.25, start: 0.07, duration: 0.09 },
    { frequency: 783.99, start: 0.14, duration: 0.16 },
  ],
};

const PEAK_GAIN = 0.4;
const ATTACK_SECONDS = 0.01;
/** A burst of highlights plays one sound */
const REPEAT_GAP_MS = 1000;
/** How long a sound waits for audio to start; later it would be stale */
const START_WAIT_MS = 200;

let audioContext: AudioContext | undefined;
/** One resume at a time: without a sound device (e.g. Firefox) it never settles */
let resuming: Promise<void> | undefined;
let lastPlayedAt = Number.NEGATIVE_INFINITY;

const getAudioContext = (): AudioContext | undefined => {
  if (typeof AudioContext === 'undefined') {
    return undefined;
  }
  try {
    audioContext ??= new AudioContext();
  } catch (err) {
    console.warn('[sounds] audio unavailable:', err);
  }
  return audioContext;
};

/** Whether audio runs, starting it if needed; a sound that has to wait longer is skipped, not played late */
const startAudio = async (context: AudioContext): Promise<boolean> => {
  if (context.state !== 'running') {
    resuming ??= context
      .resume()
      .catch((err: unknown) => {
        console.warn('[sounds] audio unavailable:', err);
      })
      .finally(() => {
        resuming = undefined;
      });
    await Promise.race([resuming, new Promise((resolve) => setTimeout(resolve, START_WAIT_MS))]);
  }
  return context.state === 'running';
};

/** Volume is 0–100; an unknown sound (e.g. a stale stored setting) plays nothing */
export const playSound = async (sound: NotificationSound, volume: number): Promise<void> => {
  if (sound === 'off' || !Object.hasOwn(TONES, sound) || !(volume > 0)) {
    return;
  }
  // Browsers refuse audio until the user has interacted with the page
  if ('userActivation' in navigator && !navigator.userActivation.hasBeenActive) {
    return;
  }
  const context = getAudioContext();
  if (context === undefined || !(await startAudio(context))) {
    return;
  }

  const peak = (PEAK_GAIN * Math.min(volume, 100)) / 100;
  for (const tone of TONES[sound]) {
    const start = context.currentTime + tone.start;
    const end = start + tone.duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = tone.frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(peak, start + ATTACK_SECONDS);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(end);
  }
};

const GESTURES = ['pointerdown', 'keydown'] as const;

/** At startup: audio starts on the user's first gesture, so the first sound doesn't wait for the device to open */
export const initSounds = (): void => {
  const start = (): void => {
    if ((getDirectSound() === 'off' && getMentionSound() === 'off') || !(getSoundVolume() > 0)) {
      return;
    }
    for (const gesture of GESTURES) {
      window.removeEventListener(gesture, start, true);
    }
    const context = getAudioContext();
    if (context !== undefined) {
      void startAudio(context);
    }
  };
  for (const gesture of GESTURES) {
    window.addEventListener(gesture, start, { capture: true, passive: true });
  }
};

const isWatching = (window: string): boolean =>
  isSameName(window, getCurrentChannelName()) &&
  typeof document !== 'undefined' &&
  document.visibilityState === 'visible' &&
  document.hasFocus();

/** For a live DM or mention, unless that conversation is open in front of the user */
export const playHighlightSound = (window: string, isDirect: boolean): void => {
  const sound = isDirect ? getDirectSound() : getMentionSound();
  const now = Date.now();
  if (sound === 'off' || isWatching(window) || now - lastPlayedAt < REPEAT_GAP_MS) {
    return;
  }
  lastPlayedAt = now;
  void playSound(sound, getSoundVolume());
};
