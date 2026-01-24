/**
 * @vitest-environment node
 */
import { describe, expect, it, afterEach, vi } from 'vitest';
import { Kernel } from '../kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import * as channelListFile from '@features/channels/store/channelList';
import * as usersFile from '@features/users/store/users';
import * as networkFile from '../network';
import * as capabilitiesFile from '../capabilities';
import i18next from '@/app/i18n';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '../../../config/config';
import { ChannelCategory } from '@shared/types';

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
    vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});

    // CAP LS with multiline indicator (*) - should buffer capabilities, not call setSupportedOption yet
    const line =
      ':chmurka.pirc.pl CAP * LS * :sts=port=6697,duration=300 unrealircd.org/link-security=2 unrealircd.org/plaintext-policy=user=allow,oper=deny,server=deny unrealircd.org/history-storage=memory draft/metadata-notify-2 draft/metadata=maxsub=10 pirc.pl/killme away-notify invite-notify extended-join userhost-in-names multi-prefix cap-notify sasl=EXTERNAL,PLAIN setname tls chghost account-notify message-tags batch server-time account-tag echo-message labeled-response draft/chathistory draft/extended-monitor';

    new Kernel({ type: 'raw', line }).handle();

    // CAP LS with multiline (*) should not trigger CAP REQ yet - waiting for more caps
    expect(mockSetSupportedOption).toBeCalledTimes(0);
    expect(mockIrcRequestMetadata).toBeCalledTimes(0);

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
    const mockIrcSendRawMessage = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});

    // CAP ACK - server acknowledged capabilities, should call setSupportedOption for each
    const line = ':saturn.pirc.pl CAP sic-test ACK :away-notify invite-notify extended-join userhost-in-names multi-prefix cap-notify account-notify message-tags batch server-time account-tag';

    new Kernel({ type: 'raw', line }).handle();

    // Should call setSupportedOption for each ACKed capability (11 caps)
    expect(mockSetSupportedOption).toBeCalledTimes(11);
    expect(mockSetSupportedOption).toHaveBeenCalledWith('away-notify');
    expect(mockSetSupportedOption).toHaveBeenCalledWith('message-tags');
    // No draft/metadata in ACK, so no ircRequestMetadata call
    expect(mockIrcRequestMetadata).toBeCalledTimes(0);
    // Should send CAP END after ACK
    expect(mockIrcSendRawMessage).toHaveBeenCalledWith('CAP END');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw ERROR #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    const mockGetIsWizardCompleted = vi.spyOn(settingsFile, 'getIsWizardCompleted').mockImplementation(() => true);
    const mockSetWizardProgress = vi.spyOn(settingsFile, 'setWizardProgress').mockImplementation(() => {});

    const line = 'ERROR :Closing Link: [1.1.1.1] (Registration Timeout)';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetIsWizardCompleted).toHaveBeenCalledTimes(1);
    expect(mockSetWizardProgress).toHaveBeenCalledTimes(0);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledWith(expect.objectContaining({ message: 'Closing Link: [1.1.1.1] (Registration Timeout)' }));
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledTimes(1);
  });

  it('test raw ERROR #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    const mockGetIsWizardCompleted = vi.spyOn(settingsFile, 'getIsWizardCompleted').mockImplementation(() => false);
    const mockSetWizardProgress = vi.spyOn(settingsFile, 'setWizardProgress').mockImplementation(() => {});

    const line = 'ERROR :Closing Link: [1.1.1.1] (Registration Timeout)';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetIsWizardCompleted).toHaveBeenCalledTimes(1);
    expect(mockSetWizardProgress).toHaveBeenCalledTimes(1);
    expect(mockSetWizardProgress).toHaveBeenCalledWith(0, 'Nie udało się połączyć z serwerem - Closing Link: [1.1.1.1] (Registration Timeout)');

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

    expect(mockSetAddUser).toHaveBeenCalledTimes(1);

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

    expect(mockSetAddUser).toHaveBeenCalledTimes(1);

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

  it('test raw JOIN self with chathistory enabled', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
    vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
    const mockIrcSendRawMessage = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
    const mockIrcRequestChatHistory = vi.spyOn(networkFile, 'ircRequestChatHistory').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'isSupportedOption').mockImplementation(() => true);
    const mockIsCapabilityEnabled = vi.spyOn(capabilitiesFile, 'isCapabilityEnabled').mockImplementation((cap) => cap === 'draft/chathistory');

    const line = '@msgid=abc123;time=2023-02-11T20:42:11.830Z :SIC-test!~SIC-test@hostname.example JOIN #mychannel * :Real Name';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledWith('#mychannel', ChannelCategory.channel);

    expect(mockIrcSendRawMessage).toHaveBeenNthCalledWith(1, 'MODE #mychannel');
    expect(mockIrcSendRawMessage).toHaveBeenNthCalledWith(2, 'WHO #mychannel %chtsunfra,152');

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

  it('test raw METADATA replaces {size} in avatar URL', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Qbick avatar * :https://usercontent.irccloud-cdn.com/avatar/s{size}/FxI0nUto';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);

    expect(mockSetUserAvatar).toHaveBeenCalledWith('Qbick', 'https://usercontent.irccloud-cdn.com/avatar/s64/FxI0nUto');
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

  it('test raw MODE user +i (invisible)', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#channel1');
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':Merovingian!~Merovingi@45.142.162.33 MODE Merovingian +i';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#channel1', message: 'Merovingian ma teraz flage +i' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw MODE user +iw (invisible and wallops)', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#channel1');
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = '@time=2026-01-24T21:57:51.724Z :Merovingian MODE Merovingian :+iw';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#channel1', message: 'Merovingian ma teraz flage +i' }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(3, expect.objectContaining({ target: '#channel1', message: 'Merovingian ma teraz flage +w' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(3);
  });

  it('test raw MODE user +o (operator)', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#channel1');
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':server MODE Merovingian +o';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#channel1', message: 'Merovingian ma teraz flage +o' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw MODE user +s (server notices)', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#channel1');
    vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':Merovingian MODE Merovingian +s';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#channel1', message: 'Merovingian ma teraz flage +s' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
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

  it('test raw MODE channel complex with multiple mode types', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#sic');
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => true);
    const mockSetUpdateUserFlag = vi.spyOn(usersFile, 'setUpdateUserFlag').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    // CHANMODES from PIRC.pl: beI,fkL,lH,cdimnprstzBCDGKMNOPQRSTVZ
    const mockGetChannelModes = vi.spyOn(settingsFile, 'getChannelModes').mockImplementation(() => ({
      A: ['b', 'e', 'I'],
      B: ['f', 'k', 'L'],
      C: ['l', 'H'],
      D: ['c', 'd', 'i', 'm', 'n', 'p', 'r', 's', 't', 'z', 'B', 'C', 'D', 'G', 'K', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'V', 'Z'],
    }));

    // Complex MODE line: +rBCfHl-o with params for f, H, l, and o
    const line = '@draft/bot;bot;msgid=gdT3UNkBQco30FbIJuhORn;time=2026-01-15T19:58:12.349Z :ChanServ!ChanServ@serwisy.pirc.pl MODE #sic +rBCfHl-o [4j#R3,4k#K3,6m#M1,3n#N3,6t]:6 15:9999m 99 zsfsesefesfesfefs';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetChannelModes).toHaveBeenCalled();
    expect(mockGetUserModes).toHaveBeenCalled();
    expect(mockIsChannel).toHaveBeenCalled();

    // The -o mode should update the user 'zsfsesefesfesfefs', not anyone else
    expect(mockSetUpdateUserFlag).toHaveBeenCalledTimes(1);
    expect(mockSetUpdateUserFlag).toHaveBeenCalledWith('zsfsesefesfesfefs', '#sic', '-', 'o', defaultUserModes);

    // Check that the message for -o mentions the correct user
    expect(mockSetAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        target: '#sic',
        message: expect.stringContaining('zsfsesefesfesfefs'),
      })
    );
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
    const mockSetSetWizardStep = vi.spyOn(settingsFile, 'setWizardStep').mockImplementation(() => {});

    const line =
      '@draft/bot;msgid=hjeGCPN39ksrHai7Rs5gda;time=2023-02-04T22:48:46.472Z :NickServ!NickServ@serwisy.pirc.pl NOTICE SIC-test :Ten nick jest zarejestrowany i chroniony. Jeśli należy do Ciebie,';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);

    expect(mockSetIsPasswordRequired).toHaveBeenCalledTimes(1);
    expect(mockSetIsPasswordRequired).toHaveBeenCalledWith(true);

    expect(mockSetSetWizardStep).toHaveBeenCalledTimes(1);
    expect(mockSetSetWizardStep).toHaveBeenCalledWith('password');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: 'Ten nick jest zarejestrowany i chroniony. Jeśli należy do Ciebie,' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw NOTICE #3', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockGetIsWizardCompleted = vi.spyOn(settingsFile, 'getIsWizardCompleted').mockImplementation(() => false);
    const mockGetConnectedTime = vi.spyOn(settingsFile, 'getConnectedTime').mockImplementation(() => Math.floor(Date.now() / 1000) - 5);
    const mockSetListRequestRemainingSeconds = vi.spyOn(settingsFile, 'setListRequestRemainingSeconds').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl NOTICE SIC-test :You have to be connected for at least 20 seconds before being able to /LIST, please ignore the fake output above';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);

    expect(mockGetIsWizardCompleted).toHaveBeenCalledTimes(1);

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
    const mockGetIsWizardCompleted = vi.spyOn(settingsFile, 'getIsWizardCompleted').mockImplementation(() => false);
    const mockGetConnectedTime = vi.spyOn(settingsFile, 'getConnectedTime').mockImplementation(() => Math.floor(Date.now() / 1000) - 5);
    const mockSetListRequestRemainingSeconds = vi.spyOn(settingsFile, 'setListRequestRemainingSeconds').mockImplementation(() => {});

    const line = ':irc.librairc.net NOTICE SIC-test :*** You cannot list within the first 60 seconds of connecting. Please try again later.';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);

    expect(mockGetIsWizardCompleted).toHaveBeenCalledTimes(1);

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
      }),
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
      }),
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
      }),
    );
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 250', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':tantalum.libera.chat 250 Merovingian :Highest connection count: 2682 (2681 clients) (389463 connections received)';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'Highest connection count: 2682 (2681 clients) (389463 connections received)' }));
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

  it('test raw 305 - no longer away', () => {
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockSetCurrentUserFlag = vi.spyOn(settingsFile, 'setCurrentUserFlag').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 305 mero-test :You are no longer marked as being away';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetCurrentUserFlag).toHaveBeenCalledWith('away', false);

    expect(mockSetAddMessageToAllChannels).toHaveBeenNthCalledWith(1, expect.objectContaining({ message: i18next.t("kernel.305.you-are-no-longer-marked-as-being-away") }));
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledTimes(1);
  });

  it('test raw 306 - now away', () => {
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockSetCurrentUserFlag = vi.spyOn(settingsFile, 'setCurrentUserFlag').mockImplementation(() => {});

    const line = ':bzyk.pirc.pl 306 mero-test :You have been marked as being away';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetCurrentUserFlag).toHaveBeenCalledWith('away', true);

    expect(mockSetAddMessageToAllChannels).toHaveBeenNthCalledWith(1, expect.objectContaining({ message: i18next.t('kernel.306.you-have-been-marked-as-being-away') }));
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledTimes(1);
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
    const mockGetIsWizardCompleted = vi.spyOn(settingsFile, 'getIsWizardCompleted').mockImplementation(() => true);

    const line = `:irc01-black.librairc.net 432 * ioiijhjkkljkljlkj :Erroneous Nickname`;

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetIsWizardCompleted).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: 'ioiijhjkkljkljlkj :Erroneous Nickname' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 432 #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockGetIsWizardCompleted = vi.spyOn(settingsFile, 'getIsWizardCompleted').mockImplementation(() => false);

    const line = `:irc01-black.librairc.net 432 * ioiijhjkkljkljlkj :Erroneous Nickname`;

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetIsWizardCompleted).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: 'ioiijhjkkljkljlkj :Erroneous Nickname' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 432 #3', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockGetIsWizardCompleted = vi.spyOn(settingsFile, 'getIsWizardCompleted').mockImplementation(() => true);

    const line = `:insomnia.pirc.pl 432 * Merovingian :Nickname is unavailable: Being held for registered user`;

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetIsWizardCompleted).toHaveBeenCalledTimes(1);

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

  it('test raw 671', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':chmurka.pirc.pl 671 sic-test Noop :is using a Secure Connection';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: '* Noop Używa bezpiecznego połączenia' }));
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

  it('test raw 761 replaces {size} in avatar URL', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 761 SIC-test Qbick Avatar * :https://usercontent.irccloud-cdn.com/avatar/s{size}/FxI0nUto';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserAvatar).toHaveBeenCalledWith('Qbick', 'https://usercontent.irccloud-cdn.com/avatar/s64/FxI0nUto');
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

  it('test raw 770 avatar', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetSupportedOption = vi.spyOn(settingsFile, 'setSupportedOption').mockImplementation(() => {});

    const line = ':jowisz.pirc.pl 770 Merovingian :avatar';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetSupportedOption).toHaveBeenCalledWith('metadata-avatar');
    expect(mockSetSupportedOption).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 770 status', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetSupportedOption = vi.spyOn(settingsFile, 'setSupportedOption').mockImplementation(() => {});

    const line = ':jowisz.pirc.pl 770 Merovingian :status';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetSupportedOption).toHaveBeenCalledWith('metadata-status');
    expect(mockSetSupportedOption).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 770 display-name', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetSupportedOption = vi.spyOn(settingsFile, 'setSupportedOption').mockImplementation(() => {});

    const line = ':jowisz.pirc.pl 770 Merovingian :display-name';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetSupportedOption).toHaveBeenCalledWith('metadata-display-name');
    expect(mockSetSupportedOption).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 761 sets currentUserAvatar for current user', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});
    const mockSetCurrentUserAvatar = vi.spyOn(settingsFile, 'setCurrentUserAvatar').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockReturnValue('TestUser');

    const line = ':insomnia.pirc.pl 761 TestUser TestUser Avatar * :https://example.com/avatar.png';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserAvatar).toHaveBeenCalledWith('TestUser', 'https://example.com/avatar.png');
    expect(mockSetCurrentUserAvatar).toHaveBeenCalledWith('https://example.com/avatar.png');
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
  });

  it('test raw 761 does not set currentUserAvatar for other user', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});
    const mockSetCurrentUserAvatar = vi.spyOn(settingsFile, 'setCurrentUserAvatar').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockReturnValue('TestUser');

    const line = ':insomnia.pirc.pl 761 TestUser OtherUser Avatar * :https://example.com/avatar.png';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserAvatar).toHaveBeenCalledWith('OtherUser', 'https://example.com/avatar.png');
    expect(mockSetCurrentUserAvatar).not.toHaveBeenCalled();
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
  });

  // ==================== New handler tests ====================

  it('test raw 010 - server redirect', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':oldserver.irc.net 010 sic-test newserver.irc.net 6697 :Please use this server';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: expect.stringContaining('newserver.irc.net') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 020 - processing connection', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':irc.swepipe.net 020 * :Please wait while we process your connection.';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'Please wait while we process your connection.' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 042 - unique ID', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':irc.swepipe.net 042 sic-test 0PNSABVS6 :your unique ID';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: '0PNSABVS6 your unique ID' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 314 - WHOWAS user info', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':server.irc.net 314 sic-test oldnick ~user some.host.com * :Real Name';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: expect.stringContaining('oldnick') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 317 - idle and signon time', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':insomnia.pirc.pl 317 sic-test toto 118 1768728754 :seconds idle, signon time';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: expect.stringContaining('toto') }));
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

  it('test raw 329 - channel created', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':chmurka.pirc.pl 329 sic-test #sic 1676587044';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#sic' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 330 - logged in as', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':server.irc.net 330 sic-test someuser :is logged in as someaccount';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: expect.stringContaining('someuser') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 338 - actual host/IP', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':server.irc.net 338 sic-test someuser ~user@host.com 192.168.1.1';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: expect.stringContaining('someuser') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 341 - inviting user', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':server.irc.net 341 sic-test inviteduser #somechannel';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: expect.stringContaining('inviteduser') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 344 - REOP/geo info', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':server.irc.net 344 sic-test someuser :is connecting from Poland';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 351 - server version', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':server.irc.net 351 sic-test UnrealIRCd-6.0.0 server.irc.net :FhiXeOoZE [*=2309]';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: expect.stringContaining('UnrealIRCd') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 354 - WHOX reply', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(usersFile, 'getHasUser').mockReturnValue(false);
    const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getUserModes').mockReturnValue(defaultUserModes);

    const line = ':insomnia.pirc.pl 354 mero 152 #Religie ~pirc ukryty-88E7A1BA.adsl.inetia.pl * JAKNEK Hs 0 :Użytkownik bramki';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddUser).toHaveBeenCalledWith(expect.objectContaining({ nick: 'JAKNEK' }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

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

  it('test raw 369 - end of WHOWAS', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':server.irc.net 369 sic-test oldnick :End of WHOWAS';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: expect.stringContaining('oldnick') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 371 - INFO line', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':server.irc.net 371 sic-test :This server is running UnrealIRCd';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'This server is running UnrealIRCd' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 374 - end of INFO', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':server.irc.net 374 sic-test :End of INFO list';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'End of INFO list' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 378 - connecting from', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':server.irc.net 378 sic-test someuser :is connecting from *@host.com 192.168.1.1';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: expect.stringContaining('someuser') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 379 - using modes', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':server.irc.net 379 sic-test someuser :is using modes +iwx';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: expect.stringContaining('someuser') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 381 - you are now IRC operator', () => {
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});

    const line = ':server.irc.net 381 sic-test :You are now an IRC operator';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledWith(expect.objectContaining({ message: i18next.t('kernel.381.you-are-now-an-irc-operator') }));
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledTimes(1);
  });

  it('test raw 382 - rehashing', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':server.irc.net 382 sic-test ircd.conf :Rehashing';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: expect.stringContaining('ircd.conf') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 391 - server time', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':server.irc.net 391 sic-test server.irc.net :Friday January 24 2026 -- 12:00:00 +00:00';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: expect.stringContaining('server.irc.net') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 401 - no such nick/channel', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':server.irc.net 401 sic-test unknownuser :No such nick/channel';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: expect.stringContaining('unknownuser') }));
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

  it('test raw 404 - cannot send to channel', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 404 sic-test #sic :You cannot send messages to channels until you\'ve been connected for 30 seconds';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#sic' }));
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

  it('test raw 412 - no text to send', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':server.irc.net 412 sic-test :No text to send';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 421 - unknown command', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':server.irc.net 421 sic-test BADCMD :Unknown command';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: expect.stringContaining('BADCMD') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 433 - nickname in use', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getIsWizardCompleted').mockReturnValue(true);

    const line = ':server.irc.net 433 * desirednick :Nickname is already in use';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: expect.stringContaining('desirednick') }));
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

  it('test raw 443 - user already on channel', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':server.irc.net 443 sic-test someuser #somechannel :is already on channel';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 447 - cannot change nick', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':insomnia.pirc.pl 447 sic-test :Can not change nickname while on #Religie (+N)';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: expect.stringContaining('#Religie') }));
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

  it('test raw 461 - not enough parameters', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');

    const line = ':server.irc.net 461 sic-test JOIN :Not enough parameters';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: expect.stringContaining('JOIN') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 464 - password incorrect', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getIsWizardCompleted').mockReturnValue(true);

    const line = ':server.irc.net 464 sic-test :Password incorrect';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: i18next.t('kernel.464.password-incorrect') }));
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

  it('test raw 482 - not channel operator', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':server.irc.net 482 sic-test #somechannel :You\'re not channel operator';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#somechannel' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 728 - quiet list entry', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':server.irc.net 728 sic-test #channel q *!*@badhost.com oper 1706123456';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#channel', message: expect.stringContaining('*!*@badhost.com') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 729 - end of quiet list', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':server.irc.net 729 sic-test #channel q :End of channel quiet list';

    new Kernel({ type: 'raw', line }).handle();

    // 729 just marks the end of quiet list, no message is displayed
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 908 - SASL mechanisms', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':server.irc.net 908 sic-test PLAIN,EXTERNAL :are available SASL mechanisms';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: expect.stringContaining('PLAIN') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  // ==================== i18n HTML entities tests ====================

  it('test i18n does not escape HTML entities in interpolated values', () => {
    // Test that URLs with special characters are not HTML-escaped
    // This verifies the fix for escapeValue: false in i18n config
    const url = 'https://thelounge.chat';
    const message = i18next.t('kernel.quit', { nick: 'user', reason: ` (Quit: ${url})` });

    // The URL should NOT be escaped to &#x2F;&#x2F;
    expect(message).toContain('https://thelounge.chat');
    expect(message).not.toContain('&#x2F;');
    expect(message).not.toContain('&#');
  });

  it('test i18n preserves special characters in quit messages', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => ['#test']);
    vi.spyOn(usersFile, 'setQuitUser').mockImplementation(() => {});

    const line = ':testuser!~test@host.example QUIT :The Lounge - https://thelounge.chat';

    new Kernel({ type: 'raw', line }).handle();

    // Verify the message contains the actual URL, not HTML entities
    expect(mockSetAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('https://thelounge.chat'),
      }),
    );
    expect(mockSetAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.not.stringContaining('&#x2F;'),
      }),
    );
  });

  describe('Private message user list population', () => {
    it('should add both sender and receiver to users list when creating new priv channel', () => {
      const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => false);
      const mockSetAddChannel = vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#other');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentUserFlags').mockImplementation(() => []);

      // Mock getHasUser to return false (users don't exist yet)
      vi.spyOn(usersFile, 'getHasUser').mockImplementation(() => false);
      const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      const mockSetJoinUser = vi.spyOn(usersFile, 'setJoinUser').mockImplementation(() => {});

      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG MyNick :Hello there';

      new Kernel({ type: 'raw', line }).handle();

      // Should create priv channel
      expect(mockSetAddChannel).toHaveBeenCalledWith('OtherUser', ChannelCategory.priv);

      // Should add both users to the channel
      expect(mockSetAddUser).toHaveBeenCalledWith(
        expect.objectContaining({
          nick: 'OtherUser',
          channels: [expect.objectContaining({ name: 'OtherUser' })],
        })
      );
      expect(mockSetAddUser).toHaveBeenCalledWith(
        expect.objectContaining({
          nick: 'MyNick',
          channels: [expect.objectContaining({ name: 'OtherUser' })],
        })
      );
    });

    it('should use setJoinUser when users already exist', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => false);
      vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#other');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentUserFlags').mockImplementation(() => []);

      // Mock getHasUser to return true (users already exist)
      vi.spyOn(usersFile, 'getHasUser').mockImplementation(() => true);
      const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      const mockSetJoinUser = vi.spyOn(usersFile, 'setJoinUser').mockImplementation(() => {});

      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG MyNick :Hello there';

      new Kernel({ type: 'raw', line }).handle();

      // Should use setJoinUser instead of setAddUser
      expect(mockSetJoinUser).toHaveBeenCalledWith('OtherUser', 'OtherUser');
      expect(mockSetJoinUser).toHaveBeenCalledWith('MyNick', 'OtherUser');
      expect(mockSetAddUser).not.toHaveBeenCalled();
    });

    it('should not add users to channel for regular channel messages', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => false);
      vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#test');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});

      vi.spyOn(usersFile, 'getHasUser').mockImplementation(() => false);
      const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      const mockSetJoinUser = vi.spyOn(usersFile, 'setJoinUser').mockImplementation(() => {});

      // This is a channel message, not a private message
      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG #channel :Hello there';

      new Kernel({ type: 'raw', line }).handle();

      // Should NOT add users for channel messages
      expect(mockSetAddUser).not.toHaveBeenCalled();
      expect(mockSetJoinUser).not.toHaveBeenCalled();
    });

    it('should not add users when priv channel already exists', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      // Channel already exists
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => 'OtherUser');
      vi.spyOn(settingsFile, 'getCurrentUserFlags').mockImplementation(() => []);

      vi.spyOn(usersFile, 'getHasUser').mockImplementation(() => false);
      const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      const mockSetJoinUser = vi.spyOn(usersFile, 'setJoinUser').mockImplementation(() => {});

      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG MyNick :Hello again';

      new Kernel({ type: 'raw', line }).handle();

      // Channel already exists, so no users should be added
      expect(mockSetAddUser).not.toHaveBeenCalled();
      expect(mockSetJoinUser).not.toHaveBeenCalled();
    });

    it('should add users for CTCP ACTION in private message', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => false);
      const mockSetAddChannel = vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#other');
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});

      vi.spyOn(usersFile, 'getHasUser').mockImplementation(() => false);
      const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});

      // CTCP ACTION in private message
      const line = '@msgid=test123;time=2023-02-12T02:06:12.210Z :OtherUser!~user@host PRIVMSG MyNick :\x01ACTION waves\x01';

      new Kernel({ type: 'raw', line }).handle();

      // Should create priv channel
      expect(mockSetAddChannel).toHaveBeenCalledWith('OtherUser', ChannelCategory.priv);

      // Should add both users
      expect(mockSetAddUser).toHaveBeenCalledTimes(2);
    });
  });
});
