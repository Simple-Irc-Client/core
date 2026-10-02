/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as channelsFile from '@features/channels/store/channels';
import i18next from '@/app/i18n';
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel core/oper/oper', () => {
  setupKernelTest();

  it('test raw 381 - you are now IRC operator', () => {
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});

    const line = ':server.irc.net 381 sic-test :You are now an IRC operator';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledWith(expect.objectContaining({ message: i18next.t('kernel.381.you-are-now-an-irc-operator') }));
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledTimes(1);
  });
});
