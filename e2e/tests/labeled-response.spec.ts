import { test, expect, type Page } from '@playwright/test';
import { connectViaWizard, projectTag } from '../helpers';
import { skipWithoutIrcv3 } from '../test-server';

/**
 * Lets a test hold every incoming WebSocket message and release them in order later, like a slow network.
 * Exposes `window.__holdIncoming(hold)`, and `window.__heldIncoming()` with the messages held. Must be called before `page.goto`.
 */
const installIncomingHold = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const OrigWS = globalThis.WebSocket;
    let holding = false;
    const held: { data: unknown; deliver: () => void }[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).WebSocket = function (url: string, protocols?: string | string[]) {
      const ws = protocols ? new OrigWS(url, protocols) : new OrigWS(url);
      const onmessage = Object.getOwnPropertyDescriptor(OrigWS.prototype, 'onmessage');
      Object.defineProperty(ws, 'onmessage', {
        get: () => onmessage?.get?.call(ws),
        set: (handler: (event: MessageEvent) => void) => {
          onmessage?.set?.call(ws, (event: MessageEvent) => {
            if (holding) {
              held.push({ data: event.data, deliver: () => handler.call(ws, event) });
            } else {
              handler.call(ws, event);
            }
          });
        },
      });
      return ws;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Object.assign((globalThis as any).WebSocket, { prototype: OrigWS.prototype, CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__holdIncoming = (hold: boolean) => {
      holding = hold;
      if (!hold) {
        for (const { deliver } of held.splice(0)) {
          deliver();
        }
      }
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__heldIncoming = () => held.map(({ data }) => String(data));
  });
};

const joinChannel = async (page: Page, channel: string): Promise<void> => {
  const messageInput = page.locator('#message-input');
  await messageInput.fill(`/join ${channel}`);
  await messageInput.press('Enter');
  await expect(page.getByRole('button', { name: channel, exact: true })).toBeVisible({ timeout: 10_000 });
};

test.describe('Labeled responses', () => {
  test('a reply that arrives after switching windows is shown where the command was typed', async ({ page }, testInfo) => {
    skipWithoutIrcv3('replies are matched to commands by labeled-response');
    const tag = projectTag(testInfo);
    await installIncomingHold(page);
    await page.goto('/');
    await connectViaWizard(page, `label-tester-${tag}`);
    await joinChannel(page, `#label-a-${tag}`);
    await joinChannel(page, `#label-b-${tag}`);

    const messageInput = page.locator('#message-input');
    const chatLog = page.getByTestId('chat-log');

    await page.getByRole('button', { name: `#label-a-${tag}`, exact: true }).click();
    await expect(messageInput).toBeEnabled();

    // The reply is held until the user is already looking at another window
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.evaluate(() => (globalThis as any).__holdIncoming(true));
    await messageInput.fill('/whois no-such-label-nick');
    await messageInput.press('Enter');
    await page.getByRole('button', { name: `#label-b-${tag}`, exact: true }).click();
    // The whole reply is in, up to its end of WHOIS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect.poll(() => page.evaluate(() => ((globalThis as any).__heldIncoming() as string[]).some((data) => / 318 /.test(data)))).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await page.evaluate(() => (globalThis as any).__holdIncoming(false));

    // Handled as it was released; rendered by the frame after next
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(chatLog.getByText(/no-such-label-nick/)).toHaveCount(0);

    await page.getByRole('button', { name: `#label-a-${tag}`, exact: true }).click();
    await expect(chatLog.getByText(/no-such-label-nick/)).toBeVisible({ timeout: 10_000 });
  });
});
