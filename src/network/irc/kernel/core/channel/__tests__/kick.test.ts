/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import * as usersFile from '@features/users/store/users';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel core/channel/kick', () => {
  setupKernelTest();

  it('test raw KICK #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'test-user');
    const mockSetRemoveUser = vi.spyOn(usersFile, 'setRemoveUser').mockImplementation(() => {});
    const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});

    const line = '@account=ratler__;msgid=qDtfbJQ2Ym74HmVRslOgeZ-mLABGCzcOme4EdMIqCME+A;time=2023-03-20T21:23:29.512Z :ratler__!~pirc@vhost:ratler.ratler KICK #Religie sic-test :ratler__';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledTimes(0);

    expect(mockSetRemoveUser).toHaveBeenCalledTimes(1);
    expect(mockSetRemoveUser).toHaveBeenCalledWith('sic-test', '#Religie');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#Religie', message: 'sic-test został wyrzucony przez ratler__ (ratler__)' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw KICK includes nick (kicker) in message for context menu', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'test-user');
    vi.spyOn(usersFile, 'setRemoveUser').mockImplementation(() => {});
    const mockUser = { nick: 'ratler__', ident: '~pirc', hostname: 'host', flags: [], channels: [] };
    vi.spyOn(usersFile, 'getUser').mockImplementation(() => mockUser);

    const line = '@msgid=abc;time=2023-03-20T21:23:29.512Z :ratler__!~pirc@host KICK #Religie sic-test :ratler__';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ nick: mockUser }));
  });

  it('test raw KICK #2 self', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'sic-test');
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#Religie');
    const mockSetRemoveUser = vi.spyOn(usersFile, 'setRemoveUser').mockImplementation(() => {});
    const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
    const mockSetRemoveChannel = vi.spyOn(channelsFile, 'setRemoveChannel').mockImplementation(() => {});

    const line = '@account=ratler__;msgid=qDtfbJQ2Ym74HmVRslOgeZ-mLABGCzcOme4EdMIqCME+A;time=2023-03-20T21:23:29.512Z :ratler__!~pirc@vhost:ratler.ratler KICK #Religie sic-test :ratler__';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledTimes(1);

    expect(mockSetRemoveUser).toHaveBeenCalledTimes(1);
    expect(mockSetRemoveUser).toHaveBeenCalledWith('sic-test', '#Religie');

    expect(mockSetRemoveChannel).toHaveBeenCalledTimes(1);
    expect(mockSetRemoveChannel).toHaveBeenCalledWith('#Religie');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'Zostałeś wyrzucony z #Religie przez ratler__ (ratler__)' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 441 - user not on channel', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':server.irc.net 441 sic-test someuser #somechannel :They aren\'t on that channel';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });
});
