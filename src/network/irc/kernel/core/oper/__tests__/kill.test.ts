/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import { DEBUG_CHANNEL } from '@/config/config';
import { setupKernelTest, defaultUserModes } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel core/oper/kill', () => {
  setupKernelTest();

  it('test raw KILL', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);

    const line = ':server KILL scc_test :Killed (Nickname collision)';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetUserModes).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessageToAllChannels).toHaveBeenNthCalledWith(1, expect.objectContaining({ message: 'Zostałeś rozłączony z serwera przez server (Killed (Nickname collision))' }));
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledTimes(1);
  });
});
