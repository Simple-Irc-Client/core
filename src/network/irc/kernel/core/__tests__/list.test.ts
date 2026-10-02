/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import * as channelListFile from '@features/channels/store/channelList';
import * as networkFile from '@/network/irc/network';
import { DEBUG_CHANNEL } from '@/config/config';
import { setupKernelTest, defaultUserModes } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel core/list', () => {
  setupKernelTest();

  it('test raw 321', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetChannelListClear = vi.spyOn(channelListFile, 'setChannelListClear').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 321 dsfdsfdsfsdfdsfsdfaas Channel :Users  Name';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetChannelListClear).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 322 #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetAddChannelToList = vi.spyOn(channelListFile, 'setAddChannelToList').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 322 dsfdsfdsfsdfdsfsdfaas #Base 1 :[+nt]';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddChannelToList).toHaveBeenCalledWith('#Base', 1, '[+nt]');
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddChannelToList).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 322 #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetAddChannelToList = vi.spyOn(channelListFile, 'setAddChannelToList').mockImplementation(() => {});

    const line = ':netsplit.pirc.pl 322 sic-test * 1 :';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddChannelToList).toHaveBeenCalledWith('*', 1, '');
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddChannelToList).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 322 #3', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetAddChannelToList = vi.spyOn(channelListFile, 'setAddChannelToList').mockImplementation(() => {});

    const line = ':netsplit.pirc.pl 322 sic-test #+Kosciol+ 1 :[+nt]';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddChannelToList).toHaveBeenCalledWith('#+Kosciol+', 1, '[+nt]');
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddChannelToList).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 323', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetChannelListFinished = vi.spyOn(channelListFile, 'setChannelListFinished').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 323 dsfdsfdsfsdfdsfsdfaas :End of /LIST';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetChannelListFinished).toHaveBeenNthCalledWith(1, true);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetChannelListFinished).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  describe('Alis fallback for LIST on IRCnet', () => {
    it('should set listDeprecated when deprecation notice is received', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      const mockSetListDeprecated = vi.spyOn(channelListFile, 'setListDeprecated').mockImplementation(() => {});
      const mockIrcSendAlisListRequest = vi.spyOn(networkFile, 'ircSendAlisListRequest').mockImplementation(() => {});

      const line = ':irc.ircnet.example NOTICE TestUser :Usage of /list for listing all channels is deprecated';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetListDeprecated).toHaveBeenCalledWith(true);
      // Should NOT immediately send Alis request — wait for 323
      expect(mockIrcSendAlisListRequest).not.toHaveBeenCalled();
    });

    it('should use LIST results when deprecated but LIST returned enough channels', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(channelListFile, 'getAlisMode').mockImplementation(() => false);
      vi.spyOn(channelListFile, 'getListDeprecated').mockImplementation(() => true);
      // Populate store with enough channels
      const channels = Array.from({ length: 500 }, (_, i) => ({ name: `#ch${i}`, users: i, topic: '' }));
      channelListFile.useChannelListStore.setState({ channels });
      const mockSetChannelListFinished = vi.spyOn(channelListFile, 'setChannelListFinished').mockImplementation(() => {});
      const mockIrcSendAlisListRequest = vi.spyOn(networkFile, 'ircSendAlisListRequest').mockImplementation(() => {});

      const line = ':tngnet.ircnet.io 323 mero3 :End of LIST';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetChannelListFinished).toHaveBeenCalledWith(true);
      expect(mockIrcSendAlisListRequest).not.toHaveBeenCalled();
    });

    it('should fall back to Alis when deprecated LIST returned too few channels', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(channelListFile, 'getAlisMode').mockImplementation(() => false);
      vi.spyOn(channelListFile, 'getListDeprecated').mockImplementation(() => true);
      // Populate store with too few channels
      channelListFile.useChannelListStore.setState({ channels: [{ name: '#a', users: 1, topic: '' }] });
      const mockSetChannelListClear = vi.spyOn(channelListFile, 'setChannelListClear').mockImplementation(() => {});
      const mockSetAlisMode = vi.spyOn(channelListFile, 'setAlisMode').mockImplementation(() => {});
      const mockIrcSendAlisListRequest = vi.spyOn(networkFile, 'ircSendAlisListRequest').mockImplementation(() => {});

      const line = ':tngnet.ircnet.io 323 mero3 :End of LIST';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetChannelListClear).toHaveBeenCalledTimes(1);
      expect(mockSetAlisMode).toHaveBeenCalledWith(true);
      expect(mockIrcSendAlisListRequest).toHaveBeenCalledTimes(1);
    });

    it('should ignore 323 End of LIST when in alisMode', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(channelListFile, 'getAlisMode').mockImplementation(() => true);
      const mockSetChannelListFinished = vi.spyOn(channelListFile, 'setChannelListFinished').mockImplementation(() => {});

      const line = ':tngnet.ircnet.io 323 mero3 :End of LIST';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetChannelListFinished).not.toHaveBeenCalled();
    });

    it('should parse Alis channel NOTICE correctly', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(channelListFile, 'getAlisMode').mockImplementation(() => true);
      const mockSetAddChannelToList = vi.spyOn(channelListFile, 'setAddChannelToList').mockImplementation(() => {});

      const line = ':Alis@hub.uk NOTICE TestUser :#programming                    \x02  42\x02: Programming discussion channel';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddChannelToList).toHaveBeenCalledWith('#programming', 42, 'Programming discussion channel');
      expect(mockSetAddMessage).toHaveBeenCalledTimes(1); // only debug channel
    });

    it('should handle Alis footer and reset alisMode', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(channelListFile, 'getAlisMode').mockImplementation(() => true);
      const mockSetChannelListFinished = vi.spyOn(channelListFile, 'setChannelListFinished').mockImplementation(() => {});
      const mockSetAlisMode = vi.spyOn(channelListFile, 'setAlisMode').mockImplementation(() => {});

      const line = ':Alis@hub.uk NOTICE TestUser :found 789 visible channels.';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetChannelListFinished).toHaveBeenCalledWith(true);
      expect(mockSetAlisMode).toHaveBeenCalledWith(false);
    });

    it('should skip Alis header line silently', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(channelListFile, 'getAlisMode').mockImplementation(() => true);
      const mockSetAddChannelToList = vi.spyOn(channelListFile, 'setAddChannelToList').mockImplementation(() => {});

      const line = ':Alis@hub.uk NOTICE TestUser :Returning a maximum of 60 channel names.';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddChannelToList).not.toHaveBeenCalled();
    });

    it('should not parse Alis NOTICE when alisMode is false', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(channelListFile, 'getAlisMode').mockImplementation(() => false);
      const mockSetAddChannelToList = vi.spyOn(channelListFile, 'setAddChannelToList').mockImplementation(() => {});

      const line = ':Alis@hub.uk NOTICE TestUser :#programming                    \x02  42\x02: Programming discussion channel';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetAddChannelToList).not.toHaveBeenCalled();
      expect(mockSetAddMessage).toHaveBeenCalledTimes(2); // debug + regular notice
    });
  });
});
