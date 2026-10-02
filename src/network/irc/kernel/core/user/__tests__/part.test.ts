/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import * as usersFile from '@features/users/store/users';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { ChannelCategory } from '@shared/types';
import { setupKernelTest, defaultUserModes } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel core/user/part', () => {
  setupKernelTest();

  it('test raw PART #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC');
    const mockSetRemoveUser = vi.spyOn(usersFile, 'setRemoveUser').mockImplementation(() => {});
    const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});

    const line = '@account=Merovingian;msgid=hXPXorNkRXTwVOTU1RbpXN-0D/dV2/Monv6zuHQw/QAGw;time=2023-02-12T22:44:07.583Z :Merovingian!~pirc@cloak:Merovingian PART #sic :Opuścił kanał';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledTimes(0);

    expect(mockSetRemoveUser).toHaveBeenCalledTimes(1);
    expect(mockSetRemoveUser).toHaveBeenCalledWith('Merovingian', '#sic');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#sic', message: 'Merovingian opuścił kanał (Opuścił kanał)' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw PART includes nick in message for context menu', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC');
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(usersFile, 'setRemoveUser').mockImplementation(() => {});
    const mockUser = { nick: 'Merovingian', ident: '~pirc', hostname: 'host', flags: [], channels: [] };
    vi.spyOn(usersFile, 'getUser').mockImplementation(() => mockUser);

    const line = '@msgid=abc;time=2023-02-12T22:44:07.583Z :Merovingian!~pirc@host PART #sic :Leaving';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ nick: mockUser }));
  });

  it('test raw PART #2 self', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'Merovingian');
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#sic');
    const mockSetRemoveUser = vi.spyOn(usersFile, 'setRemoveUser').mockImplementation(() => {});
    const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
    const mockSetRemoveChannel = vi.spyOn(channelsFile, 'setRemoveChannel').mockImplementation(() => {});

    const line = '@account=Merovingian;msgid=hXPXorNkRXTwVOTU1RbpXN-0D/dV2/Monv6zuHQw/QAGw;time=2023-02-12T22:44:07.583Z :Merovingian!~pirc@cloak:Merovingian PART #sic :Opuścił kanał';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledTimes(1);

    expect(mockSetRemoveUser).toHaveBeenCalledTimes(1);
    expect(mockSetRemoveUser).toHaveBeenCalledWith('Merovingian', '#sic');

    expect(mockSetRemoveChannel).toHaveBeenCalledTimes(1);
    expect(mockSetRemoveChannel).toHaveBeenCalledWith('#sic');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#sic', message: 'Merovingian opuścił kanał (Opuścił kanał)' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw PART #3 self', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'mero-test');
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#chat');
    const mockSetRemoveUser = vi.spyOn(usersFile, 'setRemoveUser').mockImplementation(() => {});
    const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
    const mockSetRemoveChannel = vi.spyOn(channelsFile, 'setRemoveChannel').mockImplementation(() => {});

    const line = ':mero-test!mero-test@LibraIRC-gd0.3t0.00m1ra.IP PART :#chat';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledTimes(1);

    expect(mockSetRemoveUser).toHaveBeenCalledTimes(1);
    expect(mockSetRemoveUser).toHaveBeenCalledWith('mero-test', '#chat');

    expect(mockSetRemoveChannel).toHaveBeenCalledTimes(1);
    expect(mockSetRemoveChannel).toHaveBeenCalledWith('#chat');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#chat', message: 'mero-test opuścił kanał' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw PART self of a non-current channel does not switch the view', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'Merovingian');
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#other');
    vi.spyOn(usersFile, 'setRemoveUser').mockImplementation(() => {});
    const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
    const mockSetRemoveChannel = vi.spyOn(channelsFile, 'setRemoveChannel').mockImplementation(() => {});

    const line = ':Merovingian!~pirc@cloak:Merovingian PART #sic :bye';

    new Kernel({ type: 'raw', line }).handle();

    // The parted channel is removed, but the current view stays where it was
    expect(mockSetRemoveChannel).toHaveBeenCalledWith('#sic');
    expect(mockSetCurrentChannelName).not.toHaveBeenCalled();
  });

  it('test raw 442', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = `:chmurka.pirc.pl 442 sic-test #kanjpa :You're not on that channel`;

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: '#kanjpa :Nie jesteś na tym kanale' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  // Without this, the remove button on a channel the server no longer has us in
  // sends a PART, gets 442 back, and the window never goes away
  describe('442 leftover window', () => {
    it('should drop a window the server says we are not on', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'sic-test');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => []);
      const mockSetRemoveChannel = vi.spyOn(channelsFile, 'setRemoveChannel').mockImplementation(() => {});

      new Kernel({ type: 'raw', line: `:server 442 sic-test #religie :You're not on that channel` }).handle();

      expect(mockSetRemoveChannel).toHaveBeenCalledWith('#religie');
    });

    it('should switch away from the window when it is the one on screen', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#Religie');
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'sic-test');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => []);
      vi.spyOn(channelsFile, 'setRemoveChannel').mockImplementation(() => {});
      const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});

      new Kernel({ type: 'raw', line: `:server 442 sic-test #religie :You're not on that channel` }).handle();

      expect(mockSetCurrentChannelName).toHaveBeenCalledWith(STATUS_CHANNEL, ChannelCategory.status);
    });

    it('should keep a channel we are tracked as being on', () => {
      // 442 can answer commands other than PART; a channel we hold membership
      // for locally is not a leftover and must survive
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'sic-test');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => ['#Religie']);
      const mockSetRemoveChannel = vi.spyOn(channelsFile, 'setRemoveChannel').mockImplementation(() => {});

      new Kernel({ type: 'raw', line: `:server 442 sic-test #religie :You're not on that channel` }).handle();

      expect(mockSetRemoveChannel).not.toHaveBeenCalled();
    });

    it('should do nothing when there is no window for it', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'sic-test');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => false);
      vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => []);
      const mockSetRemoveChannel = vi.spyOn(channelsFile, 'setRemoveChannel').mockImplementation(() => {});

      new Kernel({ type: 'raw', line: `:server 442 sic-test #kanjpa :You're not on that channel` }).handle();

      expect(mockSetRemoveChannel).not.toHaveBeenCalled();
    });
  });
});
