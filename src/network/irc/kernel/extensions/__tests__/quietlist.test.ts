/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as channelsFile from '@features/channels/store/channels';
import { DEBUG_CHANNEL } from '@/config/config';
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel extensions/quietlist', () => {
  setupKernelTest();

  it('test raw 728 - quiet list entry', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':server.irc.net 728 sic-test #channel q *!*@badhost.com oper 1706123456';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#channel', message: expect.stringContaining('*!*@badhost.com') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 729 - end of quiet list', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':server.irc.net 729 sic-test #channel q :End of channel quiet list';

    new Kernel({ type: 'raw', line }).handle();

    // 729 just marks the end of quiet list, no message is displayed
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });
});
