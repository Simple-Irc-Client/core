/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as channelsFile from '@features/channels/store/channels';
import * as monitorFile from '@features/monitor/store/monitor';
import * as e2eeSessionFile from '@features/e2ee/session';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel: WATCH', () => {
  setupKernelTest();

  const handle = (line: string) => {
    const setAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const online = vi.spyOn(monitorFile, 'setMultipleMonitorOnline').mockImplementation(() => {});
    const offline = vi.spyOn(monitorFile, 'setMultipleMonitorOffline').mockImplementation(() => {});
    const resume = vi.spyOn(e2eeSessionFile, 'resumePendingEncryption').mockResolvedValue();

    new Kernel({ type: 'raw', line }).handle();

    const shown = setAddMessage.mock.calls.map(([message]) => message).filter((message) => message.target !== DEBUG_CHANNEL);
    return { online, offline, resume, shown };
  };

  it.each([
    ['600', 'logged on'],
    ['604', 'is online'],
  ])('should mark a watched nick online on %s, and pick up encryption waiting for them', (numeric, text) => {
    const { online, offline, resume, shown } = handle(`:server ${numeric} me alice ~a host 1700000000 :${text}`);

    expect(online).toHaveBeenCalledWith(['alice']);
    expect(offline).not.toHaveBeenCalled();
    expect(resume).toHaveBeenCalledWith('alice');
    expect(shown.map(({ target, message }) => ({ target, message }))).toEqual([{ target: STATUS_CHANNEL, message: expect.stringContaining('alice') }]);
  });

  it.each([
    ['601', 'logged off'],
    ['605', 'is offline'],
  ])('should mark a watched nick offline on %s', (numeric, text) => {
    const { online, offline, shown } = handle(`:server ${numeric} me alice * * 0 :${text}`);

    expect(offline).toHaveBeenCalledWith(['alice']);
    expect(online).not.toHaveBeenCalled();
    expect(shown).toHaveLength(1);
    expect(shown[0]?.target).toBe(STATUS_CHANNEL);
  });

  it.each(['597', '598', '599', '602', '609'])('should say what %s tells about a watched nick in Status, without changing presence', (numeric) => {
    const { online, offline, shown } = handle(`:server ${numeric} me alice ~a host 1700000000 :some text`);

    expect(online).not.toHaveBeenCalled();
    expect(offline).not.toHaveBeenCalled();
    expect(shown).toHaveLength(1);
    expect(shown[0]?.target).toBe(STATUS_CHANNEL);
    expect(shown[0]?.message).toContain('alice');
  });

  it.each(['597', '598', '599', '600', '601', '602', '604', '605', '609'])('should ignore %s without a nick', (numeric) => {
    const { online, offline, shown } = handle(`:server ${numeric} me`);

    expect(online).not.toHaveBeenCalled();
    expect(offline).not.toHaveBeenCalled();
    expect(shown).toEqual([]);
  });

  it('should show the watch statistics, the list and its clearing in Status', () => {
    const stats = handle(':server 603 me :You have 2 and are on 1 WATCH entries').shown;
    vi.restoreAllMocks();
    const list = handle(':server 606 me :alice bob').shown;
    vi.restoreAllMocks();
    const cleared = handle(':server 608 me :Watch list cleared').shown;

    expect([...stats, ...list, ...cleared].map(({ target }) => target)).toEqual([STATUS_CHANNEL, STATUS_CHANNEL, STATUS_CHANNEL]);
    expect(stats[0]?.message).toBe('You have 2 and are on 1 WATCH entries');
    expect(list[0]?.message).toContain('alice bob');
  });

  it('should show nothing for the end of the watch list', () => {
    expect(handle(':server 607 me :End of WATCH list').shown).toEqual([]);
  });
});
