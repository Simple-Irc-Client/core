/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import * as usersFile from '@features/users/store/users';
import * as networkFile from '@/network/irc/network';
import * as capabilitiesFile from '@/network/irc/capabilities';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { ChannelCategory, MessageCategory } from '@shared/types';
import { setupKernelTest, defaultUserModes } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel core/channel/join', () => {
  setupKernelTest();

  it('test raw JOIN #1 self', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
    const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
    const mockIrcSendRawMessage = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
    const mockIrcSendCommand = vi.spyOn(networkFile, 'ircSendCommand').mockImplementation(() => false);
    const mockIsSupportedOption = vi.spyOn(settingsFile, 'isSupportedOption').mockImplementation(() => true);

    const line = '@msgid=oXhSn3eP0x5LlSJTX2SxJj-NXV6407yG5qKZnAWemhyGQ;time=2023-02-11T20:42:11.830Z :SIC-test!~SIC-test@D6D788C7.623ED634.C8132F93.IP JOIN #channel1 * :Simple Irc Client user';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledWith('#channel1', ChannelCategory.channel);

    expect(mockSetAddUser).toHaveBeenCalledTimes(1);

    expect(mockIsSupportedOption).toHaveBeenCalledTimes(1);

    expect(mockIrcSendRawMessage).toHaveBeenCalledWith('MODE #channel1');
    expect(mockIrcSendRawMessage).toHaveBeenCalledTimes(1);
    expect(mockIrcSendCommand).toHaveBeenCalledWith('WHO #channel1 %chtsunfra,152', { automatic: true });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#channel1', message: 'SIC-test dołączył do kanału' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw JOIN #2 self', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'mero-test');
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
    const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
    const mockIrcSendRawMessage = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
    const mockIrcSendCommand = vi.spyOn(networkFile, 'ircSendCommand').mockImplementation(() => false);
    const mockIsSupportedOption = vi.spyOn(settingsFile, 'isSupportedOption').mockImplementation(() => true);

    const line = ':mero-test!mero-test@LibraIRC-gd0.3t0.00m1ra.IP JOIN :#chat';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledWith('#chat', ChannelCategory.channel);

    expect(mockSetAddUser).toHaveBeenCalledTimes(1);

    expect(mockIsSupportedOption).toHaveBeenCalledTimes(1);

    expect(mockIrcSendRawMessage).toHaveBeenCalledWith('MODE #chat');
    expect(mockIrcSendRawMessage).toHaveBeenCalledTimes(1);
    expect(mockIrcSendCommand).toHaveBeenCalledWith('WHO #chat %chtsunfra,152', { automatic: true });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#chat', message: 'mero-test dołączył do kanału' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw JOIN #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC');
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
    const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});

    const line = '@msgid=oXhSn3eP0x5LlSJTX2SxJj-NXV6407yG5qKZnAWemhyGQ;time=2023-02-11T20:42:11.830Z :SIC-test!~SIC-test@D6D788C7.623ED634.C8132F93.IP JOIN #channel1 * :Simple Irc Client user';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledTimes(0);

    expect(mockSetAddUser).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#channel1', message: 'SIC-test dołączył do kanału' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw JOIN includes nick in message for context menu', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC');
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
    const mockUser = { nick: 'SIC-test', ident: '~SIC-test', hostname: 'host', flags: [], channels: [] };
    vi.spyOn(usersFile, 'getUser').mockImplementation(() => mockUser);

    const line = '@msgid=abc;time=2023-02-11T20:42:11.830Z :SIC-test!~SIC-test@host JOIN #channel1 * :realname';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ nick: mockUser }));
  });

  it('test raw JOIN falls back to nick string when user not found', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC');
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
    vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);

    const line = '@msgid=abc;time=2023-02-11T20:42:11.830Z :SIC-test!~SIC-test@host JOIN #channel1 * :realname';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ nick: 'SIC-test' }));
  });

  it('test raw JOIN self with chathistory enabled', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
    vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
    const mockIrcSendRawMessage = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
    const mockIrcSendCommand = vi.spyOn(networkFile, 'ircSendCommand').mockImplementation(() => false);
    const mockIrcRequestChatHistory = vi.spyOn(networkFile, 'ircRequestChatHistory').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'isSupportedOption').mockImplementation(() => true);
    const mockIsCapabilityEnabled = vi.spyOn(capabilitiesFile, 'isCapabilityEnabled').mockImplementation((cap) => cap === 'draft/chathistory');

    const line = '@msgid=abc123;time=2023-02-11T20:42:11.830Z :SIC-test!~SIC-test@hostname.example JOIN #mychannel * :Real Name';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledWith('#mychannel', ChannelCategory.channel);

    expect(mockIrcSendRawMessage).toHaveBeenNthCalledWith(1, 'MODE #mychannel');
    expect(mockIrcSendCommand).toHaveBeenCalledWith('WHO #mychannel %chtsunfra,152', { automatic: true });

    // Verify chathistory request is made when capability is enabled
    expect(mockIsCapabilityEnabled).toHaveBeenCalledWith('draft/chathistory');
    expect(mockIrcRequestChatHistory).toHaveBeenCalledWith('#mychannel', 'LATEST', undefined, 50);
    expect(mockIrcRequestChatHistory).toHaveBeenCalledTimes(1);
  });

  it('test raw JOIN self without chathistory capability', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
    vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
    vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
    const mockIrcRequestChatHistory = vi.spyOn(networkFile, 'ircRequestChatHistory').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'isSupportedOption').mockImplementation(() => true);
    const mockIsCapabilityEnabled = vi.spyOn(capabilitiesFile, 'isCapabilityEnabled').mockImplementation(() => false);

    const line = '@msgid=abc123;time=2023-02-11T20:42:11.830Z :SIC-test!~SIC-test@hostname.example JOIN #mychannel * :Real Name';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledWith('#mychannel', ChannelCategory.channel);

    // Verify chathistory request is NOT made when capability is disabled
    expect(mockIsCapabilityEnabled).toHaveBeenCalledWith('draft/chathistory');
    expect(mockIrcRequestChatHistory).not.toHaveBeenCalled();
  });

  it.each(['draft/metadata-2', 'draft/metadata', 'draft/metadata-notify-2'])(
    'test raw JOIN self with %s enabled requests metadata list',
    (capName) => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
      vi.spyOn(networkFile, 'ircRequestChatHistory').mockImplementation(() => {});
      const mockIrcRequestMetadataList = vi.spyOn(networkFile, 'ircRequestMetadataList').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'isSupportedOption').mockImplementation(() => true);
      vi.spyOn(capabilitiesFile, 'isCapabilityEnabled').mockImplementation((cap) => cap === capName);

      const line = '@msgid=abc123;time=2023-02-11T20:42:11.830Z :SIC-test!~SIC-test@hostname.example JOIN #mychannel * :Real Name';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockIrcRequestMetadataList).toHaveBeenCalledWith('#mychannel');
      expect(mockIrcRequestMetadataList).toHaveBeenCalledTimes(1);
    },
  );

  it('test raw JOIN self without metadata capability does not request metadata', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
    vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
    vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
    vi.spyOn(networkFile, 'ircRequestChatHistory').mockImplementation(() => {});
    const mockIrcRequestMetadataList = vi.spyOn(networkFile, 'ircRequestMetadataList').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'isSupportedOption').mockImplementation(() => true);
    vi.spyOn(capabilitiesFile, 'isCapabilityEnabled').mockImplementation(() => false);

    const line = '@msgid=abc123;time=2023-02-11T20:42:11.830Z :SIC-test!~SIC-test@hostname.example JOIN #mychannel * :Real Name';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIrcRequestMetadataList).not.toHaveBeenCalled();
  });

  it('test raw JOIN self does not switch current channel when channel already exists (rejoin on reconnect)', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
    vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
    vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'isSupportedOption').mockImplementation(() => true);
    vi.spyOn(capabilitiesFile, 'isCapabilityEnabled').mockImplementation(() => false);
    // Channel already exists (e.g. reconnect scenario)
    vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);

    const line = '@msgid=abc123;time=2023-02-11T20:42:11.830Z :SIC-test!~SIC-test@hostname.example JOIN #existing-channel * :Real Name';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetCurrentChannelName).not.toHaveBeenCalled();
  });

  it('test raw JOIN self switches current channel when channel is new', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
    vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
    vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'isSupportedOption').mockImplementation(() => true);
    vi.spyOn(capabilitiesFile, 'isCapabilityEnabled').mockImplementation(() => false);
    // Channel does not exist yet (fresh join)
    vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => false);

    const line = '@msgid=abc123;time=2023-02-11T20:42:11.830Z :SIC-test!~SIC-test@hostname.example JOIN #new-channel * :Real Name';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledWith('#new-channel', ChannelCategory.channel);
  });

  it('test raw 473', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = `:chommik.pirc.pl 473 sic-test #sic :Cannot join channel (+i)`;

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: '#sic: Nie możesz dołączyć do kanału (Kanał tylko dla zaproszonych)', category: MessageCategory.error }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 474', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = `:saturn.pirc.pl 474 mero-test #bog :Cannot join channel (+b)`;

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: '#bog: Nie możesz dołączyć do kanału (Masz bana)', category: MessageCategory.error }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 477', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = `:insomnia.pirc.pl 477 test #knajpa :You need a registered nick to join that channel.`;

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: '#knajpa: Wymagany jest zarejestrowany nick aby dołączyć do tego kanału', category: MessageCategory.error }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 328 - channel URL', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':services.librairc.net 328 sic-test #india :www.indiachat.co.in';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#india', message: expect.stringContaining('www.indiachat.co.in') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 403 - no such channel', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':server.irc.net 403 sic-test #nonexistent :No such channel';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: expect.stringContaining('#nonexistent') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 405 - too many channels', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':server.irc.net 405 sic-test #newchannel :You have joined too many channels';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 448 - cannot join channel invalid name', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':chmurka.pirc.pl 448 sic-test Global :Cannot join channel: Channel name must start with a hash mark (#)';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: expect.stringContaining('Global') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 471 - channel full', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':server.irc.net 471 sic-test #fullchannel :Cannot join channel (+l)';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 475 - bad channel key', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':server.irc.net 475 sic-test #secretchannel :Cannot join channel (+k)';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  // A channel is one channel no matter how the server or the user cased it.
  // Reported as: two "#religie" entries, one with the system messages, one with
  // the chat, and neither removable on its own.
  describe('channel name casing', () => {
    it('should adopt the server casing for a channel we already had open', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'getChannel').mockImplementation(() => ({
        name: '#religie',
        category: ChannelCategory.channel,
        messages: [],
        topic: '',
        topicSetBy: '',
        topicSetTime: 0,
        unReadMessages: 0,
        typing: [],
      }));
      const mockSetRenameChannel = vi.spyOn(channelsFile, 'setRenameChannel').mockImplementation(() => {});

      const line = ':SIC-test!~SIC-test@host JOIN #Religie';

      new Kernel({ type: 'raw', line }).handle();

      expect(mockSetRenameChannel).toHaveBeenCalledWith('#religie', '#Religie');
    });

    it('should not rename when the casing already matches', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'getChannel').mockImplementation(() => ({
        name: '#Religie',
        category: ChannelCategory.channel,
        messages: [],
        topic: '',
        topicSetBy: '',
        topicSetTime: 0,
        unReadMessages: 0,
        typing: [],
      }));
      const mockSetRenameChannel = vi.spyOn(channelsFile, 'setRenameChannel').mockImplementation(() => {});

      new Kernel({ type: 'raw', line: ':SIC-test!~SIC-test@host JOIN #Religie' }).handle();

      expect(mockSetRenameChannel).not.toHaveBeenCalled();
    });

    it('should not rename on someone else joining', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      const mockSetRenameChannel = vi.spyOn(channelsFile, 'setRenameChannel').mockImplementation(() => {});

      new Kernel({ type: 'raw', line: ':Someone!~s@host JOIN #Religie' }).handle();

      expect(mockSetRenameChannel).not.toHaveBeenCalled();
    });

    it('should treat a PART echoed in another casing as parting our channel', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#religie');
      vi.spyOn(usersFile, 'setRemoveUser').mockImplementation(() => {});
      const mockSetRemoveChannel = vi.spyOn(channelsFile, 'setRemoveChannel').mockImplementation(() => {});
      const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});

      new Kernel({ type: 'raw', line: ':SIC-test!~SIC-test@host PART #Religie :bye' }).handle();

      expect(mockSetRemoveChannel).toHaveBeenCalledWith('#Religie');
      // the window we were looking at is the same one, just cased differently
      expect(mockSetCurrentChannelName).toHaveBeenCalledWith(STATUS_CHANNEL, ChannelCategory.status);
    });

    it('should recognise our own KICK when the nick casing differs', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#religie');
      vi.spyOn(usersFile, 'setRemoveUser').mockImplementation(() => {});
      const mockSetRemoveChannel = vi.spyOn(channelsFile, 'setRemoveChannel').mockImplementation(() => {});

      new Kernel({ type: 'raw', line: ':op!~op@host KICK #Religie sic-TEST :out' }).handle();

      expect(mockSetRemoveChannel).toHaveBeenCalledWith('#Religie');
      expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL }));
    });

    it('should deliver a PRIVMSG to us when our nick comes back in another casing', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
      vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});

      new Kernel({ type: 'raw', line: ':Merovingian!~m@host PRIVMSG sic-TEST :hello' }).handle();

      // addressed to us, so it opens/goes to the DM window with the sender
      expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: 'Merovingian', message: 'hello' }));
    });
  });
});
