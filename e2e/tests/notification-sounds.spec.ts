import { test, expect, type Page } from '@playwright/test';
import { createIrcClient, type IrcClient } from '../irc-client';
import { connectViaWizard, openProfileSettings } from '../helpers';

// Rounded: AudioParam values are single precision
const CHIME = [880, 1319];
const PING = [1568];
/** Longer than the gap the app keeps between two sounds */
const SOUND_GAP_MS = 1100;
/** Longer than a sound waits for audio to start, as a sound device can take on CI */
const DEVICE_OPEN_MS = 1000;

let friend: IrcClient;
let page: Page;
let channel: string;
let userNick: string;

/** Records the rounded frequency of every tone the app plays in `window.__tones`, on a slow sound device. Must be called before `page.goto`. */
const recordTones = async (target: Page): Promise<void> => {
  await target.addInitScript((deviceOpenMs) => {
    // Audio runs only once the device has opened, however soon it is asked to resume
    const openAt = new WeakMap<AudioContext, number>();
    class SlowDeviceAudioContext extends AudioContext {
      constructor(options?: AudioContextOptions) {
        super(options);
        openAt.set(this, performance.now() + deviceOpenMs);
      }

      override get state(): AudioContextState {
        return performance.now() < (openAt.get(this) ?? 0) ? 'suspended' : super.state;
      }

      override resume(): Promise<void> {
        return new Promise<void>((resolve) => setTimeout(resolve, (openAt.get(this) ?? 0) - performance.now())).then(() => super.resume());
      }
    }
    Object.assign(globalThis, { AudioContext: SlowDeviceAudioContext });
    const tones: number[] = [];
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (this: OscillatorNode, when?: number) {
      tones.push(Math.round(this.frequency.value));
      start.call(this, when);
    };
    Object.assign(globalThis, { __tones: tones });
  }, DEVICE_OPEN_MS);
};

const playedTones = (): Promise<number[]> => page.evaluate(() => (globalThis as unknown as { __tones: number[] }).__tones.splice(0));

const expectTones = async (expected: number[]): Promise<void> => {
  const played: number[] = [];
  await expect.poll(async () => {
    played.push(...(await playedTones()));
    return played;
  }, { timeout: 10_000 }).toEqual(expected);
};

const openSettings = async (): Promise<void> => {
  await openProfileSettings(page, 'notifications');
};

test.beforeAll(async ({ browser }, testInfo) => {
  const tag = testInfo.project.name.includes('firefox') ? 'ff' : 'cr';
  channel = `#sounds-${tag}`;
  userNick = `listener-${tag}`;

  friend = await createIrcClient(`chimer-${tag}`);
  await friend.join(channel);

  page = await browser.newPage();
  await recordTones(page);
  await page.goto('/');
  await connectViaWizard(page, userNick, { channels: [channel] });
  await page.getByRole('button', { name: channel, exact: true }).click();
  await expect(page.getByTestId('users-sidebar').getByText(friend.nick, { exact: true })).toBeVisible({ timeout: 10_000 });
});

test.afterAll(async () => {
  await page?.close();
  friend?.disconnect();
});

test.describe('Notification sounds', () => {
  test.describe.configure({ mode: 'serial' });

  test('a private message plays the private message sound', async () => {
    friend.sendMessage(userNick, 'are you there?');

    await expectTones(CHIME);
  });

  test('a mention in a channel in the background plays the mention sound, an ordinary message none', async () => {
    await page.getByRole('button', { name: friend.nick, exact: true }).click();
    await page.waitForTimeout(SOUND_GAP_MS);

    friend.sendMessage(channel, 'just chatting');
    friend.sendMessage(channel, `${userNick}: look here`);

    await expectTones(PING);
  });

  test('a sound set to None stays silent', async () => {
    await openSettings();
    const mentionSelect = page.getByTestId('mention-sound-select');
    await mentionSelect.click();
    await page.getByRole('option', { name: 'None' }).click();
    // Escape before the Select hands focus back would close the Select, not the dialog
    await expect(mentionSelect).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
    await page.getByRole('button', { name: 'Status', exact: true }).click();
    await page.waitForTimeout(SOUND_GAP_MS);

    friend.sendMessage(channel, `${userNick}: silent mention`);
    friend.sendMessage(userNick, 'and a private one');

    // Both arrive in order, so the private message sound alone proves the mention played nothing
    await expectTones(CHIME);
  });

  test('the settings preview the chosen sound', async () => {
    await openSettings();
    await page.getByTestId('direct-sound-select').click();
    await page.getByRole('option', { name: 'Trill' }).click();
    await page.getByRole('button', { name: 'Play Private message sound' }).click();

    await expectTones([523, 659, 784]);
    await expect(page.getByRole('button', { name: 'Play Mention sound' })).toBeDisabled();
  });
});
