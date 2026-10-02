/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import { DEBUG_CHANNEL } from '@/config/config';
import { setupKernelTest, defaultUserModes } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel core/channel/topic', () => {
  setupKernelTest();

  it('test raw TOPIC', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockSetTopic = vi.spyOn(channelsFile, 'setTopic').mockImplementation(() => {});

    const line = '@account=Merovingian;msgid=33x8Q9DP1OpJVeJe3S7usg;time=2023-03-23T00:04:18.011Z :Merovingian!~pirc@cloak:Merovingian TOPIC #sic :Test 1';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetUserModes).toHaveBeenCalledTimes(1);

    expect(mockSetTopic).toHaveBeenCalledTimes(1);
    expect(mockSetTopic).toHaveBeenCalledWith('#sic', 'Test 1');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#sic', message: 'Merovingian ustawił temat kanału na: Test 1' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 332', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetTopic = vi.spyOn(channelsFile, 'setTopic').mockImplementation(() => {});

    const line = ':chmurka.pirc.pl 332 SIC-test #sic :Prace nad Simple Irc Client trwają';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetTopic).toHaveBeenNthCalledWith(1, '#sic', 'Prace nad Simple Irc Client trwają');
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetTopic).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 333', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetTopicSetBy = vi.spyOn(channelsFile, 'setTopicSetBy').mockImplementation(() => {});

    const line = ':chmurka.pirc.pl 333 SIC-test #sic Merovingian 1552692216';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetTopicSetBy).toHaveBeenNthCalledWith(1, '#sic', 'Merovingian', 1552692216);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetTopicSetBy).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });
});
