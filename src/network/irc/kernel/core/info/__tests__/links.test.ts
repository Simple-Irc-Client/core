/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as channelsFile from '@features/channels/store/channels';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel core/info/links', () => {
  setupKernelTest();

  it('test raw 364 - LINKS entry', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':server.irc.net 364 sic-test other.server.net main.server.net :1 Some Server';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 365 - end of LINKS', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':server.irc.net 365 sic-test * :End of /LINKS list';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });
});
