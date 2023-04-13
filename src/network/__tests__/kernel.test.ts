/**
 * @vitest-environment node
 */
import { describe, expect, it, afterEach, vi } from 'vitest';
import { Kernel } from '../kernel';
import * as settingsFile from '../../store/settings';
import * as channelsFile from '../../store/channels';
import * as channelListFile from '../../store/channelList';
import * as usersFile from '../../store/users';
import * as networkFile from '../../network/network';
import i18next from '../../i18n';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '../../config/config';
import { ChannelCategory } from '../../types';

describe('kernel tests', () => {
  const defaultUserModes = [
    { symbol: '!', flag: 'y' }, // LibraIRC
    { symbol: '~', flag: 'q' },
    { symbol: '&', flag: 'a' },
    { symbol: '@', flag: 'o' },
    { symbol: '%', flag: 'h' },
    { symbol: '+', flag: 'v' },
  ];

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('test connected', () => {
    const mockSetIsConnecting = vi.spyOn(settingsFile, 'setIsConnecting').mockImplementation(() => {});
    const mockSetIsConnected = vi.spyOn(settingsFile, 'setIsConnected').mockImplementation(() => {});
    const mockSetConnectedTime = vi.spyOn(settingsFile, 'setConnectedTime').mockImplementation(() => {});
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});

    new Kernel({ type: 'connected' }).handle();

    expect(mockSetIsConnecting).toBeCalledWith(false);
    expect(mockSetIsConnected).toBeCalledWith(true);
    expect(mockSetConnectedTime).toBeCalledTimes(1);
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledWith(expect.objectContaining({ message: i18next.t('kernel.connected') }));
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledTimes(1);
  });

  it('test close', () => {
    const mockSetIsConnecting = vi.spyOn(settingsFile, 'setIsConnecting').mockImplementation(() => {});
    const mockSetIsConnected = vi.spyOn(settingsFile, 'setIsConnected').mockImplementation(() => {});
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});

    new Kernel({ type: 'close' }).handle();

    expect(mockSetIsConnecting).toBeCalledWith(false);
    expect(mockSetIsConnected).toBeCalledWith(false);
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledWith(expect.objectContaining({ message: i18next.t('kernel.disconnected') }));
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledTimes(1);
  });

  it('test raw AWAY #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = '@account=wariatnakaftan;msgid=THDuCqdstQzWng1N5ALKi4;time=2023-03-23T17:04:33.953Z :wariatnakaftan!uid502816@vhost:far.away AWAY';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw AWAY #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = '@account=wariatnakaftan;msgid=k9mhVRzgAdqLBnnr2YboOh;time=2023-03-23T17:14:37.516Z :wariatnakaftan!uid502816@vhost:far.away AWAY :Auto-away';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw BATCH', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':netsplit.pirc.pl BATCH +0G9Zyu0qr7Jem5SdPufanF chathistory #sic';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw CAP #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetSupportedOption = vi.spyOn(settingsFile, 'setSupportedOption').mockImplementation(() => {});
    const mockIrcRequestMetadata = vi.spyOn(networkFile, 'ircRequestMetadata').mockImplementation(() => {});

    const line =
      ':chmurka.pirc.pl CAP * LS * :sts=port=6697,duration=300 unrealircd.org/link-security=2 unrealircd.org/plaintext-policy=user=allow,oper=deny,server=deny unrealircd.org/history-storage=memory draft/metadata-notify-2 draft/metadata=maxsub=10 pirc.pl/killme away-notify invite-notify extended-join userhost-in-names multi-prefix cap-notify sasl=EXTERNAL,PLAIN setname tls chghost account-notify message-tags batch server-time account-tag echo-message labeled-response draft/chathistory draft/extended-monitor';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetSupportedOption).toBeCalledTimes(1);
    expect(mockSetSupportedOption).toHaveBeenCalledWith('metadata');
    expect(mockIrcRequestMetadata).toBeCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it.skip('test raw CAP #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetSupportedOption = vi.spyOn(settingsFile, 'setSupportedOption').mockImplementation(() => {});
    const mockIrcRequestMetadata = vi.spyOn(networkFile, 'ircRequestMetadata').mockImplementation(() => {});

    const line = ':jowisz.pirc.pl CAP * LS :unrealircd.org/json-log';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetSupportedOption).toBeCalledTimes(0);
    expect(mockIrcRequestMetadata).toBeCalledTimes(0);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw CAP #3', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetSupportedOption = vi.spyOn(settingsFile, 'setSupportedOption').mockImplementation(() => {});
    const mockIrcRequestMetadata = vi.spyOn(networkFile, 'ircRequestMetadata').mockImplementation(() => {});

    const line = ':saturn.pirc.pl CAP sic-test ACK :away-notify invite-notify extended-join userhost-in-names multi-prefix cap-notify account-notify message-tags batch server-time account-tag';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetSupportedOption).toBeCalledTimes(0);
    expect(mockIrcRequestMetadata).toBeCalledTimes(0);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw ERROR #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    const mockGetIsCreatorCompleted = vi.spyOn(settingsFile, 'getIsCreatorCompleted').mockImplementation(() => true);
    const mockSetCreatorProgress = vi.spyOn(settingsFile, 'setCreatorProgress').mockImplementation(() => {});

    const line = 'ERROR :Closing Link: [1.1.1.1] (Registration Timeout)';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetIsCreatorCompleted).toHaveBeenCalledTimes(1);
    expect(mockSetCreatorProgress).toHaveBeenCalledTimes(0);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledWith(expect.objectContaining({ message: 'Closing Link: [1.1.1.1] (Registration Timeout)' }));
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledTimes(1);
  });

  it('test raw ERROR #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    const mockGetIsCreatorCompleted = vi.spyOn(settingsFile, 'getIsCreatorCompleted').mockImplementation(() => false);
    const mockSetCreatorProgress = vi.spyOn(settingsFile, 'setCreatorProgress').mockImplementation(() => {});

    const line = 'ERROR :Closing Link: [1.1.1.1] (Registration Timeout)';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetIsCreatorCompleted).toHaveBeenCalledTimes(1);
    expect(mockSetCreatorProgress).toHaveBeenCalledTimes(1);
    expect(mockSetCreatorProgress).toHaveBeenCalledWith(0, 'Nie udało się połączyć z serwerem - Closing Link: [1.1.1.1] (Registration Timeout)');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledWith(expect.objectContaining({ message: 'Closing Link: [1.1.1.1] (Registration Timeout)' }));
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledTimes(1);
  });

  it('test raw INVITE', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#channel1');

    const line = '@msgid=WglKE4an4Y6MGcC9tVM7jV;time=2023-03-23T00:58:29.305Z :mero!~mero@D6D788C7.623ED634.C8132F93.IP INVITE sic-test :#sic';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#channel1', message: 'mero zaprasza do kanału: #sic' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw JOIN #1 self', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
    const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
    const mockIrcSendRawMessage = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
    const mockIsSupportedOption = vi.spyOn(settingsFile, 'isSupportedOption').mockImplementation(() => true);

    const line = '@msgid=oXhSn3eP0x5LlSJTX2SxJj-NXV6407yG5qKZnAWemhyGQ;time=2023-02-11T20:42:11.830Z :SIC-test!~SIC-test@D6D788C7.623ED634.C8132F93.IP JOIN #channel1 * :Simple Irc Client user';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledWith('#channel1', ChannelCategory.channel);

    expect(mockSetAddUser).toHaveBeenCalledTimes(0);

    expect(mockIsSupportedOption).toHaveBeenCalledTimes(1);

    expect(mockIrcSendRawMessage).toHaveBeenNthCalledWith(1, 'MODE #channel1');
    expect(mockIrcSendRawMessage).toHaveBeenNthCalledWith(2, 'WHO #channel1 %chtsunfra,152');
    expect(mockIrcSendRawMessage).toHaveBeenCalledTimes(2);

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
    const mockIsSupportedOption = vi.spyOn(settingsFile, 'isSupportedOption').mockImplementation(() => true);

    const line = ':mero-test!mero-test@LibraIRC-gd0.3t0.00m1ra.IP JOIN :#chat';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledWith('#chat', ChannelCategory.channel);

    expect(mockSetAddUser).toHaveBeenCalledTimes(0);

    expect(mockIsSupportedOption).toHaveBeenCalledTimes(1);

    expect(mockIrcSendRawMessage).toHaveBeenNthCalledWith(1, 'MODE #chat');
    expect(mockIrcSendRawMessage).toHaveBeenNthCalledWith(2, 'WHO #chat %chtsunfra,152');
    expect(mockIrcSendRawMessage).toHaveBeenCalledTimes(2);

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

  it('test raw KICK #2 self', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'sic-test');
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

  it('test raw METADATA', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop avatar * :https://www.gravatar.com/avatar/55a2daf22200bd0f31cdb6b720911a74.jpg';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);

    expect(mockSetUserAvatar).toHaveBeenCalledWith('Noop', 'https://www.gravatar.com/avatar/55a2daf22200bd0f31cdb6b720911a74.jpg');
    expect(mockSetUserAvatar).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw MODE user #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#channel1');
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);
    const mockSetUpdateUserFlag = vi.spyOn(usersFile, 'setUpdateUserFlag').mockImplementation(() => {});

    const line = ':mero MODE mero :+xz';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockIsChannel).toHaveBeenCalledTimes(1);
    expect(mockSetUpdateUserFlag).toHaveBeenCalledTimes(0);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'mero ma teraz flage +x' }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(3, expect.objectContaining({ target: '#channel1', message: 'mero ma teraz flage +z' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(3);
  });

  it('test raw MODE channel user #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#sic');
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => true);
    const mockSetUpdateUserFlag = vi.spyOn(usersFile, 'setUpdateUserFlag').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);

    const line = '@draft/bot;msgid=zAfMgqBIJHiIfUCpDbbUfm;time=2023-03-27T23:49:47.290Z :ChanServ!ChanServ@serwisy.pirc.pl MODE #sic +qo Merovingian Merovingian';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockIsChannel).toHaveBeenCalledTimes(1);
    expect(mockSetUpdateUserFlag).toHaveBeenCalledTimes(2);
    expect(mockSetUpdateUserFlag).toHaveBeenNthCalledWith(1, 'Merovingian', '#sic', '+', 'q', defaultUserModes);
    expect(mockSetUpdateUserFlag).toHaveBeenNthCalledWith(2, 'Merovingian', '#sic', '+', 'o', defaultUserModes);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#sic', message: 'Merovingian ma teraz flage +q (ustawił ChanServ)' }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(3, expect.objectContaining({ target: '#sic', message: 'Merovingian ma teraz flage +o (ustawił ChanServ)' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(3);
  });

  it('test raw NICK #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockSetRenameUser = vi.spyOn(usersFile, 'setRenameUser').mockImplementation(() => {});
    const mockGetUserChannels = vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => ['#channel1', '#channel2']);

    const line = '@msgid=ls4nEYgZI42LXbsrfkcwcc;time=2023-02-12T14:20:53.072Z :Merovingian NICK :Niezident36707';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);

    expect(mockGetUserChannels).toHaveBeenCalledTimes(1);
    expect(mockGetUserChannels).toHaveBeenCalledWith('Merovingian');

    expect(mockSetRenameUser).toHaveBeenCalledTimes(1);
    expect(mockSetRenameUser).toHaveBeenCalledWith('Merovingian', 'Niezident36707');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#channel1', message: 'Merovingian zmienił nick na Niezident36707' }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(3, expect.objectContaining({ target: '#channel2', message: 'Merovingian zmienił nick na Niezident36707' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(3);
  });

  it('test raw NICK #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockSetRenameUser = vi.spyOn(usersFile, 'setRenameUser').mockImplementation(() => {});
    const mockSetNick = vi.spyOn(settingsFile, 'setNick').mockImplementation(() => {});
    const mockGetUserChannels = vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => ['#channel1', '#channel2']);

    const line = '@msgid=ls4nEYgZI42LXbsrfkcwcc;time=2023-02-12T14:20:53.072Z :SIC-test NICK :Niezident36707';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);

    expect(mockGetUserChannels).toHaveBeenCalledTimes(1);
    expect(mockGetUserChannels).toHaveBeenNthCalledWith(1, 'SIC-test');

    expect(mockSetRenameUser).toHaveBeenCalledTimes(1);
    expect(mockSetRenameUser).toHaveBeenNthCalledWith(1, 'SIC-test', 'Niezident36707');

    expect(mockSetNick).toHaveBeenCalledTimes(1);
    expect(mockSetNick).toHaveBeenCalledWith('Niezident36707');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#channel1', message: 'SIC-test zmienił nick na Niezident36707' }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(3, expect.objectContaining({ target: '#channel2', message: 'SIC-test zmienił nick na Niezident36707' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(3);
  });

  it('test raw NOTICE #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);

    const line = '@draft/bot;msgid=mcOQVkbTRyuCcC0Rso27IB;time=2023-02-22T00:20:59.308Z :Pomocnik!pomocny@bot:kanalowy.pomocnik NOTICE mero-test :[#religie] Dla trolli są inne kanały...';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: '[#religie] Dla trolli są inne kanały...' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw NOTICE #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockSetIsPasswordRequired = vi.spyOn(settingsFile, 'setIsPasswordRequired').mockImplementation(() => {});
    const mockSetSetCreatorStep = vi.spyOn(settingsFile, 'setCreatorStep').mockImplementation(() => {});

    const line =
      '@draft/bot;msgid=hjeGCPN39ksrHai7Rs5gda;time=2023-02-04T22:48:46.472Z :NickServ!NickServ@serwisy.pirc.pl NOTICE SIC-test :Ten nick jest zarejestrowany i chroniony. Jeśli należy do Ciebie,';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);

    expect(mockSetIsPasswordRequired).toHaveBeenCalledTimes(1);
    expect(mockSetIsPasswordRequired).toHaveBeenCalledWith(true);

    expect(mockSetSetCreatorStep).toHaveBeenCalledTimes(1);
    expect(mockSetSetCreatorStep).toHaveBeenCalledWith('password');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: 'Ten nick jest zarejestrowany i chroniony. Jeśli należy do Ciebie,' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw NOTICE #3', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockGetIsCreatorCompleted = vi.spyOn(settingsFile, 'getIsCreatorCompleted').mockImplementation(() => false);
    const mockGetConnectedTime = vi.spyOn(settingsFile, 'getConnectedTime').mockImplementation(() => Math.floor(Date.now() / 1000) - 5);
    const mockSetListRequestRemainingSeconds = vi.spyOn(settingsFile, 'setListRequestRemainingSeconds').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl NOTICE SIC-test :You have to be connected for at least 20 seconds before being able to /LIST, please ignore the fake output above';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);

    expect(mockGetIsCreatorCompleted).toHaveBeenCalledTimes(1);

    expect(mockGetConnectedTime).toHaveBeenCalledTimes(1);

    expect(mockSetListRequestRemainingSeconds).toHaveBeenCalledTimes(1);
    expect(mockSetListRequestRemainingSeconds).toHaveBeenCalledWith(15);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw NOTICE #4', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockGetIsCreatorCompleted = vi.spyOn(settingsFile, 'getIsCreatorCompleted').mockImplementation(() => false);
    const mockGetConnectedTime = vi.spyOn(settingsFile, 'getConnectedTime').mockImplementation(() => Math.floor(Date.now() / 1000) - 5);
    const mockSetListRequestRemainingSeconds = vi.spyOn(settingsFile, 'setListRequestRemainingSeconds').mockImplementation(() => {});

    const line = ':irc.librairc.net NOTICE SIC-test :*** You cannot list within the first 60 seconds of connecting. Please try again later.';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);

    expect(mockGetIsCreatorCompleted).toHaveBeenCalledTimes(1);

    expect(mockGetConnectedTime).toHaveBeenCalledTimes(1);

    expect(mockSetListRequestRemainingSeconds).toHaveBeenCalledTimes(1);
    expect(mockSetListRequestRemainingSeconds).toHaveBeenCalledWith(55);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

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

  it('test raw PART #2 self', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'Merovingian');
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

  it('test raw PING', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = 'PING :F549DB3';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw PONG', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = '@msgid=MIikH9lopbKqOQpz8ADjfP;time=2023-03-20T23:07:21.701Z :chmurka.pirc.pl PONG chmurka.pirc.pl :1679353641686';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw PRIVMSG #1 channel', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockExistChannel = vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
    const mockSetTyping = vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
    const mockGetUser = vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#sic');
    const mockSetIncreaseUnreadMessages = vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});

    const line = '@batch=UEaMMV4PXL3ymLItBEAhBO;msgid=498xEffzvc3SBMJsRPQ5Iq;time=2023-02-12T02:06:12.210Z :SIC-test2!~mero@D6D788C7.623ED634.C8132F93.IP PRIVMSG #sic :test 1';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockSetIncreaseUnreadMessages).toHaveBeenCalledTimes(0);

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);

    expect(mockExistChannel).toHaveBeenCalledTimes(1);
    expect(mockExistChannel).toHaveBeenCalledWith('#sic');

    expect(mockSetTyping).toHaveBeenCalledTimes(1);
    expect(mockSetTyping).toHaveBeenCalledWith('#sic', 'SIC-test2', 'done');

    expect(mockGetUser).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#sic', message: 'test 1' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw PRIVMSG #1 priv', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockExistChannel = vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
    const mockSetTyping = vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
    const mockGetUser = vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#sic');
    const mockSetIncreaseUnreadMessages = vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});

    const line = '@batch=UEaMMV4PXL3ymLItBEAhBO;msgid=498xEffzvc3SBMJsRPQ5Iq;time=2023-02-12T02:06:12.210Z :SIC-test2!~mero@D6D788C7.623ED634.C8132F93.IP PRIVMSG SIC-test :test 1';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);

    expect(mockExistChannel).toHaveBeenCalledTimes(1);
    expect(mockExistChannel).toHaveBeenCalledWith('SIC-test2');

    expect(mockSetIncreaseUnreadMessages).toHaveBeenCalledTimes(1);
    expect(mockSetIncreaseUnreadMessages).toHaveBeenCalledWith('SIC-test2');

    expect(mockSetTyping).toHaveBeenCalledTimes(0);

    expect(mockGetUser).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: 'SIC-test2', message: 'test 1' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw QUIT', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetQuitUser = vi.spyOn(usersFile, 'setQuitUser').mockImplementation(() => {});

    const line = '@msgid=aGJTRBjAMOMRB6Ky2ucXbV-Gved4HyF6QNSHYfzOX1jOA;time=2023-03-11T00:52:21.568Z :mero!~mero@D6D788C7.623ED634.C8132F93.IP QUIT :Quit: Leaving';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetQuitUser).toHaveBeenCalledTimes(1);
    expect(mockSetQuitUser).toHaveBeenCalledWith('mero', expect.objectContaining({ message: 'mero opuścił serwer (Quit: Leaving)' }));

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw TAGMSG', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockSetTyping = vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});

    const line =
      '@+draft/typing=active;+typing=active;account=kato_starszy;msgid=tsfqUigTlAhCbQYkVpty5s;time=2023-03-04T19:16:23.158Z :kato_starszy!~pirc@ukryty-FF796E25.net130.okay.pl TAGMSG #Religie';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetUserModes).toHaveBeenCalledTimes(1);

    expect(mockSetTyping).toHaveBeenCalledTimes(1);
    expect(mockSetTyping).toHaveBeenCalledWith('#Religie', 'kato_starszy', 'active');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

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

  it('test raw 001', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockIrcSendList = vi.spyOn(networkFile, 'ircSendList').mockImplementation(() => {});

    const line = ':netsplit.pirc.pl 001 SIC-test :Welcome to the pirc.pl IRC Network SIC-test!~SIC-test@1.1.1.1';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIrcSendList).toBeCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'Welcome to the pirc.pl IRC Network SIC-test!~SIC-test@1.1.1.1' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 002', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':netsplit.pirc.pl 002 SIC-test :Your host is netsplit.pirc.pl, running version UnrealIRCd-6.0.3';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'Your host is netsplit.pirc.pl, running version UnrealIRCd-6.0.3' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 003', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':netsplit.pirc.pl 003 SIC-test :This server was created Sun May 8 2022 at 13:49:18 UTC';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'This server was created Sun May 8 2022 at 13:49:18 UTC' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 004', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':netsplit.pirc.pl 004 SIC-test netsplit.pirc.pl UnrealIRCd-6.0.3 diknopqrstwxzBDFGHINRSTWZ beIacdfhiklmnopqrstvzBCDGHKLMNOPQRSTVZ';
    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        target: STATUS_CHANNEL,
        message: 'netsplit.pirc.pl UnrealIRCd-6.0.3 diknopqrstwxzBDFGHINRSTWZ beIacdfhiklmnopqrstvzBCDGHKLMNOPQRSTVZ',
      })
    );
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 005 chantypes', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const mockSetChannelTypes = vi.spyOn(settingsFile, 'setChannelTypes').mockImplementation(() => {});
    const mockSetChannelModes = vi.spyOn(settingsFile, 'setChannelModes').mockImplementation(() => {});
    const mockSetSupportedOption = vi.spyOn(settingsFile, 'setSupportedOption').mockImplementation(() => {});
    const mockIrcSendNamesXProto = vi.spyOn(networkFile, 'ircSendNamesXProto').mockImplementation(() => {});

    const line =
      ':netsplit.pirc.pl 005 SIC-test AWAYLEN=307 BOT=B CASEMAPPING=ascii CHANLIMIT=#:30 CHANMODES=beI,fkL,lH,cdimnprstzBCDGKMNOPQRSTVZ CHANNELLEN=32 CHANTYPES=# CHATHISTORY=50 CLIENTTAGDENY=*,-draft/typing,-typing,-draft/reply DEAF=d ELIST=MNUCT EXCEPTS :are supported by this server';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetChannelTypes).toHaveBeenNthCalledWith(1, ['#']);

    expect(mockSetChannelTypes).toHaveBeenCalledTimes(1);

    expect(mockSetChannelModes).toHaveBeenCalledTimes(1);
    expect(mockSetChannelModes).toHaveBeenCalledWith({
      A: ['b', 'e', 'I'],
      B: ['f', 'k', 'L'],
      C: ['l', 'H'],
      D: ['c', 'd', 'i', 'm', 'n', 'p', 'r', 's', 't', 'z', 'B', 'C', 'D', 'G', 'K', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'V', 'Z'],
    });

    expect(mockSetSupportedOption).toHaveBeenCalledTimes(0);
    expect(mockIrcSendNamesXProto).toHaveBeenCalledTimes(0);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        target: STATUS_CHANNEL,
        message:
          'AWAYLEN=307 BOT=B CASEMAPPING=ascii CHANLIMIT=#:30 CHANMODES=beI,fkL,lH,cdimnprstzBCDGKMNOPQRSTVZ CHANNELLEN=32 CHANTYPES=# CHATHISTORY=50 CLIENTTAGDENY=*,-draft/typing,-typing,-draft/reply DEAF=d ELIST=MNUCT EXCEPTS :are supported by this server',
      })
    );
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 005 prefix', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const mockSetUserModes = vi.spyOn(settingsFile, 'setUserModes').mockImplementation(() => {});
    const mockSetSupportedOption = vi.spyOn(settingsFile, 'setSupportedOption').mockImplementation(() => {});
    const mockSetChannelModes = vi.spyOn(settingsFile, 'setChannelModes').mockImplementation(() => {});
    const mockIrcSendNamesXProto = vi.spyOn(networkFile, 'ircSendNamesXProto').mockImplementation(() => {});

    const line =
      ':netsplit.pirc.pl 005 SIC-test MONITOR=128 NAMELEN=50 NAMESX NETWORK=pirc.pl NICKLEN=30 PREFIX=(qaohv)~&@%+ QUITLEN=307 SAFELIST SILENCE=15 STATUSMSG=~&@%+ TARGMAX=DCCALLOW:,ISON:,JOIN:,KICK:4,KILL:,LIST:,NAMES:1,NOTICE:1,PART:,PRIVMSG:4,SAJOIN:,SAPART:,TAGMSG:1,USERHOST:,USERIP:,WATCH:,WHOIS:1,WHOWAS:1 TOPICLEN=360 :are supported by this server';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserModes).toHaveBeenNthCalledWith(1, [
      { flag: 'q', symbol: '~' },
      { flag: 'a', symbol: '&' },
      { flag: 'o', symbol: '@' },
      { flag: 'h', symbol: '%' },
      { flag: 'v', symbol: '+' },
    ]);
    expect(mockSetUserModes).toHaveBeenCalledTimes(1);
    expect(mockSetChannelModes).toHaveBeenCalledTimes(0);
    expect(mockSetSupportedOption).toHaveBeenCalledWith('NAMESX');
    expect(mockIrcSendNamesXProto).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        target: STATUS_CHANNEL,
        message:
          'MONITOR=128 NAMELEN=50 NAMESX NETWORK=pirc.pl NICKLEN=30 PREFIX=(qaohv)~&@%+ QUITLEN=307 SAFELIST SILENCE=15 STATUSMSG=~&@%+ TARGMAX=DCCALLOW:,ISON:,JOIN:,KICK:4,KILL:,LIST:,NAMES:1,NOTICE:1,PART:,PRIVMSG:4,SAJOIN:,SAPART:,TAGMSG:1,USERHOST:,USERIP:,WATCH:,WHOIS:1,WHOWAS:1 TOPICLEN=360 :are supported by this server',
      })
    );
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 251', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':saturn.pirc.pl 251 SIC-test :There are 158 users and 113 invisible on 10 servers';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'There are 158 users and 113 invisible on 10 servers' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 252', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':saturn.pirc.pl 252 SIC-test 27 :operator(s) online';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: '27 :operator(s) online' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 253', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':saturn.pirc.pl 253 SIC-test -14 :unknown connection(s)';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: '-14 :unknown connection(s)' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 254', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':saturn.pirc.pl 254 SIC-test 185 :channels formed';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: '185 :channels formed' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 255', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':saturn.pirc.pl 255 SIC-test :I have 42 clients and 0 servers';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'I have 42 clients and 0 servers' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 265', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':saturn.pirc.pl 265 SIC-test 42 62 :Current local users 42, max 62';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'Current local users 42, max 62' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 266', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':saturn.pirc.pl 266 SIC-test 271 1721 :Current global users 271, max 1721';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'Current global users 271, max 1721' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 276', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':chmurka.pirc.pl 276 sic-test k4be :has client certificate fingerprint 56fca76';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: '* k4be has client certificate fingerprint 56fca76' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 301', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':chmurka.pirc.pl 301 sic-test Noop :gone';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: '* Noop Jest nieobecny (gone)' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 307', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':chmurka.pirc.pl 307 sic-test Noop :is identified for this nick';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: '* Noop Ten nick jest zarejestrowany' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 312', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':chmurka.pirc.pl 312 sic-test Noop insomnia.pirc.pl :IRC lepszy od spania!';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: '* Noop Jest na serwerze: insomnia.pirc.pl (IRC lepszy od spania!)' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 313 #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':chmurka.pirc.pl 313 sic-test k4be :is an IRC Operator';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: '* k4be To IRC Operator' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 313 #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':chmurka.pirc.pl 313 sic-test k4be :is a Network Service';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: '* k4be To Network Service' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 318', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':chmurka.pirc.pl 311 sic-test Noop ~Noop ukryty-29093CCD.compute-1.amazonaws.com * :*';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: '* Noop Host: ~Noop ukryty-29093CCD.compute-1.amazonaws.com * :*' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 319', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);

    const line = ':chmurka.pirc.pl 319 sic-test Noop :@#onet_quiz @#scc @#sic';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockGetUserModes).toBeCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: '* Noop Jest na kanałach: #onet_quiz #scc #sic' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 318', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':chmurka.pirc.pl 318 sic-test Noop :End of /WHOIS list.';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 320', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':chmurka.pirc.pl 320 sic-test k4be :a Network Administrator';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: '* k4be To Network Administrator' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

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

  it('test raw 335', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':chmurka.pirc.pl 335 sic-test Noop :is a \u0002Bot\u0002 on pirc.pl';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: '* Noop To Bot' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 353 #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockGetHasUser = vi.spyOn(usersFile, 'getHasUser').mockImplementation(() => false);
    const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});

    const line =
      ':chmurka.pirc.pl 353 sic-test = #Religie :aleksa7!~aleksa7@vhost:kohana.aleksia +Alisha!~user@397FF66D:D8E4ABEE:5838DA6D:IP +ProrokCodzienny!~ProrokCod@AB43659:6EA4AE53:B58B785A:IP &@Pomocnik!pomocny@bot:kanalowy.pomocnik';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetUserModes).toHaveBeenCalledTimes(4);
    expect(mockGetHasUser).toHaveBeenCalledTimes(4);
    expect(mockSetAddUser).toHaveBeenCalledTimes(4);
    expect(mockSetAddUser).toHaveBeenNthCalledWith(1, {
      channels: [{ name: '#Religie', flags: [], maxPermission: -1 }],
      hostname: 'vhost:kohana.aleksia',
      ident: '~aleksa7',
      flags: [],
      nick: 'aleksa7',
    });
    expect(mockSetAddUser).toHaveBeenNthCalledWith(2, {
      channels: [{ name: '#Religie', flags: ['v'], maxPermission: 251 }],
      hostname: '397FF66D:D8E4ABEE:5838DA6D:IP',
      ident: '~user',
      flags: [],
      nick: 'Alisha',
    });
    expect(mockSetAddUser).toHaveBeenNthCalledWith(3, {
      channels: [{ name: '#Religie', flags: ['v'], maxPermission: 251 }],
      hostname: 'AB43659:6EA4AE53:B58B785A:IP',
      ident: '~ProrokCod',
      flags: [],
      nick: 'ProrokCodzienny',
    });
    expect(mockSetAddUser).toHaveBeenNthCalledWith(4, {
      channels: [{ name: '#Religie', flags: ['a', 'o'], maxPermission: 254 }],
      hostname: 'bot:kanalowy.pomocnik',
      ident: 'pomocny',
      flags: [],
      nick: 'Pomocnik',
    });
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 353 #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockGetHasUser = vi.spyOn(usersFile, 'getHasUser').mockImplementation(() => true);
    const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
    const mockSetJoinUser = vi.spyOn(usersFile, 'setJoinUser').mockImplementation(() => {});

    const line = ':chmurka.pirc.pl 353 sic-test = #Religie :aleksa7!~aleksa7@vhost:kohana.aleksia';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockGetHasUser).toHaveBeenCalledTimes(1);
    expect(mockSetAddUser).toHaveBeenCalledTimes(0);
    expect(mockSetJoinUser).toHaveBeenNthCalledWith(1, 'aleksa7', '#Religie');
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 353 #3', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockGetHasUser = vi.spyOn(usersFile, 'getHasUser').mockImplementation(() => false);
    const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});

    const line =
      ':irc01-black.librairc.net 353 mero-test = #chat :ircbot!ircbot@ircbot.botop.librairc.net Freak!Freak@LibraIRC-ug4.vta.mvnbg3.IP WatchDog!WatchDog@Watchdog.botop.librairc.net !~@iBan!iBan@iBan.botop.librairc.net !iBot!iBot@iBot.botop.librairc.net';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetUserModes).toHaveBeenCalledTimes(5);
    expect(mockGetHasUser).toHaveBeenCalledTimes(5);

    expect(mockSetAddUser).toHaveBeenCalledTimes(5);
    expect(mockSetAddUser).toHaveBeenNthCalledWith(1, {
      channels: [{ name: '#chat', flags: [], maxPermission: -1 }],
      hostname: 'ircbot.botop.librairc.net',
      ident: 'ircbot',
      flags: [],
      nick: 'ircbot',
    });
    expect(mockSetAddUser).toHaveBeenNthCalledWith(2, {
      channels: [{ name: '#chat', flags: [], maxPermission: -1 }],
      hostname: 'LibraIRC-ug4.vta.mvnbg3.IP',
      ident: 'Freak',
      flags: [],
      nick: 'Freak',
    });
    expect(mockSetAddUser).toHaveBeenNthCalledWith(3, {
      channels: [{ name: '#chat', flags: [], maxPermission: -1 }],
      hostname: 'Watchdog.botop.librairc.net',
      ident: 'WatchDog',
      flags: [],
      nick: 'WatchDog',
    });
    expect(mockSetAddUser).toHaveBeenNthCalledWith(4, {
      channels: [{ name: '#chat', flags: ['y', 'q', 'o'], maxPermission: 256 }],
      hostname: 'iBan.botop.librairc.net',
      ident: 'iBan',
      flags: [],
      nick: 'iBan',
    });
    expect(mockSetAddUser).toHaveBeenNthCalledWith(5, {
      channels: [{ name: '#chat', flags: ['y'], maxPermission: 256 }],
      hostname: 'iBot.botop.librairc.net',
      ident: 'iBot',
      flags: [],
      nick: 'iBot',
    });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 366', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':bzyk.pirc.pl 366 SIC-test #sic :End of /NAMES list.';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 372', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':saturn.pirc.pl 372 SIC-test :- 2/6/2022 11:27';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: '- 2/6/2022 11:27' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 375', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':saturn.pirc.pl 375 SIC-test :- saturn.pirc.pl Message of the Day -';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: '- saturn.pirc.pl Message of the Day -' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 376', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':saturn.pirc.pl 376 SIC-test :End of /MOTD command.';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'End of /MOTD command.' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 396', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':chmurka.pirc.pl 396 sic-test A.A.A.IP :is now your displayed host';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'A.A.A.IP :is now your displayed host' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 432 #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockGetIsCreatorCompleted = vi.spyOn(settingsFile, 'getIsCreatorCompleted').mockImplementation(() => true);

    const line = `:irc01-black.librairc.net 432 * ioiijhjkkljkljlkj :Erroneous Nickname`;

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetIsCreatorCompleted).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: 'ioiijhjkkljkljlkj :Erroneous Nickname' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 432 #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockGetIsCreatorCompleted = vi.spyOn(settingsFile, 'getIsCreatorCompleted').mockImplementation(() => false);

    const line = `:irc01-black.librairc.net 432 * ioiijhjkkljkljlkj :Erroneous Nickname`;

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetIsCreatorCompleted).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: 'ioiijhjkkljkljlkj :Erroneous Nickname' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 432 #3', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockGetIsCreatorCompleted = vi.spyOn(settingsFile, 'getIsCreatorCompleted').mockImplementation(() => true);

    const line = `:insomnia.pirc.pl 432 * Merovingian :Nickname is unavailable: Being held for registered user`;

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetIsCreatorCompleted).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: 'Merovingian :Nickname is unavailable: Being held for registered user' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
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

  it('test raw 473', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = `:chommik.pirc.pl 473 sic-test #sic :Cannot join channel (+i)`;

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: '#sic :Nie możesz dołączyć do kanału (Kanał tylko dla zaproszonych)' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 474', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = `:saturn.pirc.pl 474 mero-test #bog :Cannot join channel (+b)`;

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: '#bog :Nie możesz dołączyć do kanału (Masz bana)' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 477', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = `:insomnia.pirc.pl 477 test #knajpa :You need a registered nick to join that channel.`;

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: '#knajpa :Wymagany jest zarejestrowany nick aby dołączyć do tego kanału' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 761', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 761 SIC-test Merovingian Avatar * :https://www.gravatar.com/avatar/8fadd198f40929e83421dd81e36f5637.jpg';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserAvatar).toHaveBeenCalledWith('Merovingian', 'https://www.gravatar.com/avatar/8fadd198f40929e83421dd81e36f5637.jpg');
    expect(mockSetUserAvatar).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 762', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':chmurka.pirc.pl 762 SIC-test :end of metadata';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 766', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 766 SIC-test SIC-test Avatar :no matching key';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });
});
