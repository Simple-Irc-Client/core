/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as channelsFile from '@features/channels/store/channels';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel core/info/time', () => {
  setupKernelTest();

  it('test raw 391 - server time', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':server.irc.net 391 sic-test server.irc.net :Friday January 24 2026 -- 12:00:00 +00:00';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: expect.stringContaining('server.irc.net') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });
});
