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
import * as stsFile from '../sts';
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

  it('test close during STS upgrade should trigger STS reconnection', () => {
    const mockSetIsConnecting = vi.spyOn(settingsFile, 'setIsConnecting').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'setIsConnected').mockImplementation(() => {});
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    const mockGetPendingSTSUpgrade = vi.spyOn(stsFile, 'getPendingSTSUpgrade').mockImplementation(() => ({
      host: 'irc.test.com',
      port: 6697,
      reason: 'sts_upgrade',
    }));
    const mockIncrementSTSRetries = vi.spyOn(stsFile, 'incrementSTSRetries').mockImplementation(() => {});
    vi.spyOn(stsFile, 'hasExhaustedSTSRetries').mockImplementation(() => false);
    vi.spyOn(settingsFile, 'getServer').mockImplementation(() => ({
      default: 0,
      encoding: 'utf8',
      network: 'test',
      servers: ['irc.test.com'],
    }));
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'testNick');

    new Kernel({ type: 'close' }).handle();

    // Should delegate to handleSocketClose for STS reconnection
    expect(mockGetPendingSTSUpgrade).toHaveBeenCalled();
    expect(mockIncrementSTSRetries).toHaveBeenCalledTimes(1);
    expect(mockSetIsConnecting).toBeCalledWith(true);
    // Should NOT show disconnected message
    expect(mockSetAddMessageToAllChannels).not.toHaveBeenCalled();
  });

  it('test connected clears pending STS upgrade', () => {
    const mockSetIsConnecting = vi.spyOn(settingsFile, 'setIsConnecting').mockImplementation(() => {});
    const mockSetIsConnected = vi.spyOn(settingsFile, 'setIsConnected').mockImplementation(() => {});
    const mockSetConnectedTime = vi.spyOn(settingsFile, 'setConnectedTime').mockImplementation(() => {});
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    const mockClearPendingSTSUpgrade = vi.spyOn(stsFile, 'clearPendingSTSUpgrade').mockImplementation(() => {});
    const mockResetSTSRetries = vi.spyOn(stsFile, 'resetSTSRetries').mockImplementation(() => {});

    new Kernel({ type: 'connected' }).handle();

    expect(mockSetIsConnecting).toBeCalledWith(false);
    expect(mockSetIsConnected).toBeCalledWith(true);
    expect(mockSetConnectedTime).toBeCalledTimes(1);
    // Should clear STS state on successful connection
    expect(mockClearPendingSTSUpgrade).toHaveBeenCalledTimes(1);
    expect(mockResetSTSRetries).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledWith(expect.objectContaining({ message: i18next.t('kernel.connected') }));
  });

  it('test socket close during STS upgrade does not clear pending upgrade', () => {
    const mockSetIsConnecting = vi.spyOn(settingsFile, 'setIsConnecting').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getServer').mockImplementation(() => ({
      network: 'TestNetwork',
      servers: ['irc.test.com:6667'],
      default: 0,
      encoding: 'utf-8',
    }));
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    const mockGetPendingSTSUpgrade = vi.spyOn(stsFile, 'getPendingSTSUpgrade').mockImplementation(() => ({
      host: 'irc.test.com',
      port: 6697,
      reason: 'sts_upgrade',
    }));
    const mockClearPendingSTSUpgrade = vi.spyOn(stsFile, 'clearPendingSTSUpgrade').mockImplementation(() => {});
    const mockIncrementSTSRetries = vi.spyOn(stsFile, 'incrementSTSRetries').mockImplementation(() => {});
    vi.spyOn(stsFile, 'hasExhaustedSTSRetries').mockImplementation(() => false);

    new Kernel({ type: 'socket close' }).handle();

    expect(mockGetPendingSTSUpgrade).toHaveBeenCalled();
    expect(mockIncrementSTSRetries).toHaveBeenCalledTimes(1);
    // Should NOT clear pending upgrade - handleDisconnected needs it
    expect(mockClearPendingSTSUpgrade).not.toHaveBeenCalled();
    expect(mockSetIsConnecting).toBeCalledWith(true);
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

  it('test raw ERROR skipped during STS upgrade', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    const mockGetIsWizardCompleted = vi.spyOn(settingsFile, 'getIsWizardCompleted').mockImplementation(() => false);
    const mockSetWizardProgress = vi.spyOn(settingsFile, 'setWizardProgress').mockImplementation(() => {});
    const mockGetPendingSTSUpgrade = vi.spyOn(stsFile, 'getPendingSTSUpgrade').mockImplementation(() => ({
      host: 'irc.test.com',
      port: 6697,
      reason: 'sts_upgrade',
    }));

    const line = 'ERROR :Closing Link: [1.1.1.1] (Upgrading to secure connection)';

    new Kernel({ type: 'raw', line }).handle();

    // Should skip showing error during STS upgrade
    expect(mockGetPendingSTSUpgrade).toHaveBeenCalledTimes(1);
    expect(mockGetIsWizardCompleted).not.toHaveBeenCalled();
    expect(mockSetWizardProgress).not.toHaveBeenCalled();
    expect(mockSetAddMessageToAllChannels).not.toHaveBeenCalled();

    // Debug message should still be logged
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
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

  it('test raw METADATA display-name for user', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserDisplayName = vi.spyOn(usersFile, 'setUserDisplayName').mockImplementation(() => {});
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop display-name * :John Doe';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);

    expect(mockSetUserDisplayName).toHaveBeenCalledWith('Noop', 'John Doe');
    expect(mockSetUserDisplayName).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA display-name for channel', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetChannelDisplayName = vi.spyOn(channelsFile, 'setChannelDisplayName').mockImplementation(() => {});
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => true);

    const line = ':netsplit.pirc.pl METADATA #test display-name * :Test Channel';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);

    expect(mockSetChannelDisplayName).toHaveBeenCalledWith('#test', 'Test Channel');
    expect(mockSetChannelDisplayName).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA display-name with spaces', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserDisplayName = vi.spyOn(usersFile, 'setUserDisplayName').mockImplementation(() => {});
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop display-name * :John Michael Doe Jr.';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);

    expect(mockSetUserDisplayName).toHaveBeenCalledWith('Noop', 'John Michael Doe Jr.');
    expect(mockSetUserDisplayName).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA status for user', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserStatus = vi.spyOn(usersFile, 'setUserStatus').mockImplementation(() => {});
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop status * :Working from home';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);

    expect(mockSetUserStatus).toHaveBeenCalledWith('Noop', 'Working from home');
    expect(mockSetUserStatus).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA status with spaces', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserStatus = vi.spyOn(usersFile, 'setUserStatus').mockImplementation(() => {});
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop status * :On vacation until Monday';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);

    expect(mockSetUserStatus).toHaveBeenCalledWith('Noop', 'On vacation until Monday');
    expect(mockSetUserStatus).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA status clears for current user', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserStatus = vi.spyOn(usersFile, 'setUserStatus').mockImplementation(() => {});
    const mockSetCurrentUserStatus = vi.spyOn(settingsFile, 'setCurrentUserStatus').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA TestUser status * :';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentNick).toHaveBeenCalled();

    expect(mockSetUserStatus).toHaveBeenCalledWith('TestUser', undefined);
    expect(mockSetUserStatus).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentUserStatus).toHaveBeenCalledWith(undefined);
    expect(mockSetCurrentUserStatus).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA homepage for user', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserHomepage = vi.spyOn(usersFile, 'setUserHomepage').mockImplementation(() => {});
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop homepage * :https://example.com';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);

    expect(mockSetUserHomepage).toHaveBeenCalledWith('Noop', 'https://example.com');
    expect(mockSetUserHomepage).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA homepage clears with empty value', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserHomepage = vi.spyOn(usersFile, 'setUserHomepage').mockImplementation(() => {});
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA TestUser homepage * :';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);

    expect(mockSetUserHomepage).toHaveBeenCalledWith('TestUser', undefined);
    expect(mockSetUserHomepage).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA homepage saves for current user', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserHomepage = vi.spyOn(usersFile, 'setUserHomepage').mockImplementation(() => {});
    const mockSetCurrentUserHomepage = vi.spyOn(settingsFile, 'setCurrentUserHomepage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA TestUser homepage * :https://mywebsite.com';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentNick).toHaveBeenCalled();

    expect(mockSetUserHomepage).toHaveBeenCalledWith('TestUser', 'https://mywebsite.com');
    expect(mockSetUserHomepage).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentUserHomepage).toHaveBeenCalledWith('https://mywebsite.com');
    expect(mockSetCurrentUserHomepage).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA color for user', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserColor = vi.spyOn(usersFile, 'setUserColor').mockImplementation(() => {});
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA Noop color * :#ff5500';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);

    expect(mockSetUserColor).toHaveBeenCalledWith('Noop', '#ff5500');
    expect(mockSetUserColor).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA color saves for current user', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserColor = vi.spyOn(usersFile, 'setUserColor').mockImplementation(() => {});
    const mockSetCurrentUserColor = vi.spyOn(settingsFile, 'setCurrentUserColor').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA TestUser color * :#00ff00';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentNick).toHaveBeenCalled();

    expect(mockSetUserColor).toHaveBeenCalledWith('TestUser', '#00ff00');
    expect(mockSetUserColor).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentUserColor).toHaveBeenCalledWith('#00ff00');
    expect(mockSetCurrentUserColor).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw METADATA color clears for current user', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserColor = vi.spyOn(usersFile, 'setUserColor').mockImplementation(() => {});
    const mockSetCurrentUserColor = vi.spyOn(settingsFile, 'setCurrentUserColor').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    const mockIsChannel = vi.spyOn(channelsFile, 'isChannel').mockImplementation(() => false);

    const line = ':netsplit.pirc.pl METADATA TestUser color * :';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockIsChannel).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentNick).toHaveBeenCalled();

    expect(mockSetUserColor).not.toHaveBeenCalled();
    expect(mockSetCurrentUserColor).toHaveBeenCalledWith(undefined);
    expect(mockSetCurrentUserColor).toHaveBeenCalledTimes(1);
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

  it('test raw NOTICE password required - Polish version', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    const mockSetIsPasswordRequired = vi.spyOn(settingsFile, 'setIsPasswordRequired').mockImplementation(() => {});
    const mockSetWizardStep = vi.spyOn(settingsFile, 'setWizardStep').mockImplementation(() => {});

    const line = ':NickServ!NickServ@services.example.com NOTICE TestUser :Ten nick jest zarejestrowany i chroniony. Jeśli należy do Ciebie, zaloguj się za pomocą /msg NickServ IDENTIFY hasło.';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);

    expect(mockSetIsPasswordRequired).toHaveBeenCalledTimes(1);
    expect(mockSetIsPasswordRequired).toHaveBeenCalledWith(true);

    expect(mockSetWizardStep).toHaveBeenCalledTimes(1);
    expect(mockSetWizardStep).toHaveBeenCalledWith('password');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: 'Ten nick jest zarejestrowany i chroniony. Jeśli należy do Ciebie, zaloguj się za pomocą /msg NickServ IDENTIFY hasło.' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw NOTICE password required - English version 1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    const mockSetIsPasswordRequired = vi.spyOn(settingsFile, 'setIsPasswordRequired').mockImplementation(() => {});
    const mockSetWizardStep = vi.spyOn(settingsFile, 'setWizardStep').mockImplementation(() => {});

    const line = ':NickServ!NickServ@services.example.com NOTICE TestUser :This nickname is registered and protected. If this is your nick, please identify with /msg NickServ IDENTIFY password.';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);

    expect(mockSetIsPasswordRequired).toHaveBeenCalledTimes(1);
    expect(mockSetIsPasswordRequired).toHaveBeenCalledWith(true);

    expect(mockSetWizardStep).toHaveBeenCalledTimes(1);
    expect(mockSetWizardStep).toHaveBeenCalledWith('password');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: 'This nickname is registered and protected. If this is your nick, please identify with /msg NickServ IDENTIFY password.' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });



  it('test raw NOTICE password required - English version 2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    const mockSetIsPasswordRequired = vi.spyOn(settingsFile, 'setIsPasswordRequired').mockImplementation(() => {});
    const mockSetWizardStep = vi.spyOn(settingsFile, 'setWizardStep').mockImplementation(() => {});

    const line = ':NickServ!NickServ@services.example.com NOTICE TestUser :This nickname is registered. Please choose a different nickname, or identify via /msg NickServ IDENTIFY password.';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);

    expect(mockSetIsPasswordRequired).toHaveBeenCalledTimes(1);
    expect(mockSetIsPasswordRequired).toHaveBeenCalledWith(true);

    expect(mockSetWizardStep).toHaveBeenCalledTimes(1);
    expect(mockSetWizardStep).toHaveBeenCalledWith('password');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: 'This nickname is registered. Please choose a different nickname, or identify via /msg NickServ IDENTIFY password.' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw NOTICE password required - should not trigger for non-NickServ messages', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    const mockSetIsPasswordRequired = vi.spyOn(settingsFile, 'setIsPasswordRequired').mockImplementation(() => {});
    const mockSetWizardStep = vi.spyOn(settingsFile, 'setWizardStep').mockImplementation(() => {});

    const line = ':ChanServ!ChanServ@services.example.com NOTICE TestUser :This nickname is registered and protected. If this is your nick, please identify with /msg NickServ IDENTIFY password.';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    // getCurrentNick is not called for non-NickServ messages since the condition nick === 'NickServ' fails early
    expect(mockGetCurrentNick).not.toHaveBeenCalled();

    // Should NOT trigger password required logic for non-NickServ messages
    expect(mockSetIsPasswordRequired).not.toHaveBeenCalled();
    expect(mockSetWizardStep).not.toHaveBeenCalled();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: 'This nickname is registered and protected. If this is your nick, please identify with /msg NickServ IDENTIFY password.' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw NOTICE password required - should not trigger for different target', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    const mockSetIsPasswordRequired = vi.spyOn(settingsFile, 'setIsPasswordRequired').mockImplementation(() => {});
    const mockSetWizardStep = vi.spyOn(settingsFile, 'setWizardStep').mockImplementation(() => {});

    const line = ':NickServ!NickServ@services.example.com NOTICE OtherUser :This nickname is registered and protected. If this is your nick, please identify with /msg NickServ IDENTIFY password.';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);

    // Should NOT trigger password required logic for different target
    expect(mockSetIsPasswordRequired).not.toHaveBeenCalled();
    expect(mockSetWizardStep).not.toHaveBeenCalled();

    // Message should still be added to debug channel and current channel (normal NOTICE behavior)
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: 'This nickname is registered and protected. If this is your nick, please identify with /msg NickServ IDENTIFY password.' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
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

  it('test raw TAGMSG for private message uses sender nick as channel', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
    const mockExistChannel = vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
    const mockSetTyping = vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});

    // When Bob sends a typing notification in a private message, the IRC target is our nick
    const line = '@+draft/typing=active;+typing=active;msgid=abc123;time=2023-03-04T19:16:23.158Z :Bob!~bob@host TAGMSG MyNick';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentNick).toHaveBeenCalled();
    expect(mockExistChannel).toHaveBeenCalledWith('Bob');

    // The typing should be stored under Bob's nick (the sender), not MyNick (the target)
    // This matches how PRIVMSG stores messages in a PRIV window named after the sender
    expect(mockSetTyping).toHaveBeenCalledTimes(1);
    expect(mockSetTyping).toHaveBeenCalledWith('Bob', 'Bob', 'active');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw TAGMSG for private message creates PRIV channel if not exists', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'MyNick');
    const mockExistChannel = vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => false);
    const mockSetAddChannel = vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});
    const mockSetTyping = vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});

    // When Bob sends a typing notification before any message, the PRIV channel doesn't exist yet
    const line = '@+draft/typing=active;+typing=active;msgid=abc123;time=2023-03-04T19:16:23.158Z :Bob!~bob@host TAGMSG MyNick';

    new Kernel({ type: 'raw', line }).handle();

    // Should create the PRIV channel
    expect(mockExistChannel).toHaveBeenCalledWith('Bob');
    expect(mockSetAddChannel).toHaveBeenCalledTimes(1);
    expect(mockSetAddChannel).toHaveBeenCalledWith('Bob', ChannelCategory.priv);

    // Then set typing
    expect(mockSetTyping).toHaveBeenCalledTimes(1);
    expect(mockSetTyping).toHaveBeenCalledWith('Bob', 'Bob', 'active');
  });

  it('test raw TAGMSG for private message with real IRC message format', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'Merovingian');
    vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true); // Channel already exists
    const mockSetTyping = vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});

    // Real IRC message from the user's case
    const line = '@+draft/typing=active;+typing=active;account=M89;msgid=XBPeJPmEaLR2Ag9kJ6vqDi;time=2026-01-25T00:03:21.074Z :M89!~pirc@ukryty-AD0145A7.play-internet.pl TAGMSG Merovingian';

    new Kernel({ type: 'raw', line }).handle();

    // The typing should be stored under M89's nick (the sender)
    expect(mockSetTyping).toHaveBeenCalledTimes(1);
    expect(mockSetTyping).toHaveBeenCalledWith('M89', 'M89', 'active');
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
    const mockSetUserAway = vi.spyOn(usersFile, 'setUserAway').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 305 mero-test :You are no longer marked as being away';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetCurrentUserFlag).toHaveBeenCalledWith('away', false);
    expect(mockSetUserAway).toHaveBeenCalledWith('mero-test', false);

    expect(mockSetAddMessageToAllChannels).toHaveBeenNthCalledWith(1, expect.objectContaining({ message: i18next.t("kernel.305.you-are-no-longer-marked-as-being-away") }));
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledTimes(1);
  });

  it('test raw 306 - now away', () => {
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockSetCurrentUserFlag = vi.spyOn(settingsFile, 'setCurrentUserFlag').mockImplementation(() => {});
    const mockSetUserAway = vi.spyOn(usersFile, 'setUserAway').mockImplementation(() => {});

    const line = ':bzyk.pirc.pl 306 mero-test :You have been marked as being away';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockGetCurrentChannelName).toBeCalledTimes(1);
    expect(mockSetCurrentUserFlag).toHaveBeenCalledWith('away', true);
    expect(mockSetUserAway).toHaveBeenCalledWith('mero-test', true);

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
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
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
      vi.spyOn(usersFile, 'setJoinUser').mockImplementation(() => {});

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

  describe('fuzzy tests', () => {
    // Helper functions for generating random data
    const randomString = (length: number): string => {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    const randomNick = (): string => {
      const prefixes = ['', '~', '&', '@', '%', '+'];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      return prefix + randomString(Math.floor(Math.random() * 15) + 1);
    };

    const randomChannel = (): string => {
      const prefixes = ['#', '&', '+', '!'];
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      return prefix + randomString(Math.floor(Math.random() * 20) + 1);
    };

    const randomHostmask = (): string => {
      const nick = randomString(Math.floor(Math.random() * 15) + 1);
      const ident = randomString(Math.floor(Math.random() * 10) + 1);
      const host = randomString(Math.floor(Math.random() * 30) + 1);
      return `${nick}!~${ident}@${host}`;
    };

    const randomTags = (): string => {
      const tags: string[] = [];
      const tagCount = Math.floor(Math.random() * 5);
      for (let i = 0; i < tagCount; i++) {
        const key = randomString(Math.floor(Math.random() * 10) + 1);
        const value = randomString(Math.floor(Math.random() * 20));
        tags.push(`${key}=${value}`);
      }
      return tags.length > 0 ? '@' + tags.join(';') + ' ' : '';
    };

    const randomMsgid = (): string => {
      return `@msgid=${randomString(22)};time=${new Date().toISOString()} `;
    };

    // Setup common mocks for all fuzzy tests
    const setupMocks = () => {
      vi.spyOn(settingsFile, 'setIsConnecting').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setIsConnected').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setConnectedTime').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'testuser');
      vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#test');
      vi.spyOn(settingsFile, 'getIsWizardCompleted').mockImplementation(() => true);
      vi.spyOn(settingsFile, 'setSupportedOption').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setNick').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setChannelModes').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setUserModes').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setChannelTypes').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setWizardProgress').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setWizardStep').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setMonitorLimit').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setSilenceLimit').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setWatchLimit').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setListRequestRemainingSeconds').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'getChannelModes').mockImplementation(() => ({ A: [], B: [], C: [], D: [] }));
      vi.spyOn(settingsFile, 'isSupportedOption').mockImplementation(() => false);
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setRemoveChannel').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTopic').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTopicSetBy').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(channelsFile, 'isChannel').mockImplementation((name) => name?.startsWith('#') || name?.startsWith('&'));
      vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setRemoveUser').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setJoinUser').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setQuitUser').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setRenameUser').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setUpdateUserFlag').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setUserColor').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setUserAccount').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setUserAway').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setUserHost').mockImplementation(() => {});
      vi.spyOn(usersFile, 'setUserRealname').mockImplementation(() => {});
      vi.spyOn(usersFile, 'getHasUser').mockImplementation(() => true);
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => ({ nick: 'testuser', flags: [], ident: '', hostname: '', channels: [] }));
      vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => ['#test']);
      vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
      vi.spyOn(networkFile, 'ircRequestMetadata').mockImplementation(() => {});
      vi.spyOn(networkFile, 'ircRequestChatHistory').mockImplementation(() => {});
      vi.spyOn(networkFile, 'ircSendList').mockImplementation(() => {});
      vi.spyOn(capabilitiesFile, 'parseCapabilityList').mockImplementation(() => ({}));
      vi.spyOn(capabilitiesFile, 'addAvailableCapabilities').mockImplementation(() => {});
      vi.spyOn(capabilitiesFile, 'getCapabilitiesToRequest').mockImplementation(() => []);
      vi.spyOn(capabilitiesFile, 'markCapabilitiesRequested').mockImplementation(() => {});
      vi.spyOn(capabilitiesFile, 'markCapabilitiesAcknowledged').mockImplementation(() => {});
      vi.spyOn(capabilitiesFile, 'setAwaitingMoreCaps').mockImplementation(() => {});
      vi.spyOn(capabilitiesFile, 'endCapNegotiation').mockImplementation(() => {});
      vi.spyOn(capabilitiesFile, 'isCapabilityEnabled').mockImplementation(() => false);
      vi.spyOn(channelListFile, 'setAddChannelToList').mockImplementation(() => {});
      vi.spyOn(channelListFile, 'setChannelListClear').mockImplementation(() => {});
      vi.spyOn(channelListFile, 'setChannelListFinished').mockImplementation(() => {});
    };

    describe('random string fuzzing', () => {
      it('should not crash on completely random strings', () => {
        setupMocks();

        for (let i = 0; i < 100; i++) {
          const randomLine = randomString(Math.floor(Math.random() * 500) + 1);
          expect(() => new Kernel({ type: 'raw', line: randomLine }).handle()).not.toThrow();
        }
      });

      it('should not crash on empty and whitespace strings', () => {
        setupMocks();

        const edgeCases = ['', ' ', '  ', '\t', '\n', '\r\n', '   \t\n  ', '\0', '\x00\x01\x02'];
        for (const testCase of edgeCases) {
          expect(() => new Kernel({ type: 'raw', line: testCase }).handle()).not.toThrow();
        }
      });

      it('should not crash on unicode and special characters', () => {
        setupMocks();

        const unicodeCases = [
          '🔥🎉💻',
          'こんにちは',
          'Привет мир',
          '🏳️‍🌈',
          '\u0000\u001F\u007F',
          '©®™',
          '∞≠≤≥',
          'Ñoño',
          '\uFFFD\uFFFE\uFFFF',
        ];
        for (const testCase of unicodeCases) {
          expect(() => new Kernel({ type: 'raw', line: testCase }).handle()).not.toThrow();
        }
      });

      it('should not crash on very long strings', () => {
        setupMocks();

        const longStrings = [randomString(1000), randomString(5000), randomString(10000), 'A'.repeat(50000)];
        for (const testCase of longStrings) {
          expect(() => new Kernel({ type: 'raw', line: testCase }).handle()).not.toThrow();
        }
      });

      it('should not crash on strings with IRC special characters', () => {
        setupMocks();

        const ircSpecialCases = [
          ':',
          '::',
          ':::',
          '@',
          '@@',
          '@@@',
          ':@:@:',
          '@ :',
          ': @',
          '\x01',
          '\x01ACTION\x01',
          '\x02\x03\x0F\x16\x1D\x1F',
          ':nick!user@host',
          '@tag=value :nick!user@host COMMAND',
        ];
        for (const testCase of ircSpecialCases) {
          expect(() => new Kernel({ type: 'raw', line: testCase }).handle()).not.toThrow();
        }
      });
    });

    describe('PRIVMSG fuzzing', () => {
      it('should not crash on fuzzed PRIVMSG messages', () => {
        setupMocks();

        for (let i = 0; i < 50; i++) {
          const line = `${randomMsgid()}:${randomHostmask()} PRIVMSG ${randomChannel()} :${randomString(Math.floor(Math.random() * 200))}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on PRIVMSG with malformed targets', () => {
        setupMocks();

        const malformedTargets = ['', ' ', '#', '&', '+', '!', '##', '&&', randomString(500)];
        for (const target of malformedTargets) {
          const line = `@msgid=test;time=2023-01-01T00:00:00.000Z :user!~user@host PRIVMSG ${target} :message`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on PRIVMSG with CTCP variations', () => {
        setupMocks();

        const ctcpVariations = [
          '\x01',
          '\x01\x01',
          '\x01ACTION\x01',
          '\x01VERSION\x01',
          '\x01PING ' + randomString(20) + '\x01',
          '\x01' + randomString(50) + '\x01',
          '\x01ACTION ' + randomString(100) + '\x01',
        ];
        for (const ctcp of ctcpVariations) {
          const line = `@msgid=test;time=2023-01-01T00:00:00.000Z :user!~user@host PRIVMSG #channel :${ctcp}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('MODE fuzzing', () => {
      it('should not crash on fuzzed channel MODE messages', () => {
        setupMocks();

        for (let i = 0; i < 50; i++) {
          const modes = ['+', '-', '+o', '-o', '+v', '-v', '+b', '-b', '+k', '-k', '+l', '-l', '+i', '-i', '+m', '-m', '+n', '-n', '+s', '-s', '+t', '-t'];
          const mode = modes[Math.floor(Math.random() * modes.length)];
          const args = Math.random() > 0.5 ? ' ' + randomNick() : '';
          const line = `:${randomHostmask()} MODE ${randomChannel()} ${mode}${args}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on MODE with complex mode strings', () => {
        setupMocks();

        const complexModes = [
          '+ooo nick1 nick2 nick3',
          '-vvv nick1 nick2 nick3',
          '+ov-b nick1 nick2 *!*@*.host',
          '+kb key *!*@host',
          '+l 100',
          '-l',
          '+' + 'o'.repeat(20) + ' ' + Array(20).fill('nick').join(' '),
          '-' + randomString(50),
          '+' + randomString(50) + ' ' + randomString(50),
        ];
        for (const modes of complexModes) {
          const line = `:server MODE #channel ${modes}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on user MODE messages', () => {
        setupMocks();

        const userModes = ['+i', '-i', '+w', '-w', '+o', '-o', '+x', '-x', '+' + randomString(10), '-' + randomString(10)];
        for (const mode of userModes) {
          const line = `:nick MODE nick ${mode}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('JOIN fuzzing', () => {
      it('should not crash on fuzzed JOIN messages', () => {
        setupMocks();

        for (let i = 0; i < 50; i++) {
          const channel = randomChannel();
          const line = `${randomTags()}:${randomHostmask()} JOIN ${channel}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on JOIN with extended-join data', () => {
        setupMocks();

        const extendedJoins = [
          ':nick!user@host JOIN #channel account :Real Name',
          ':nick!user@host JOIN #channel * :Real Name',
          ':nick!user@host JOIN #channel account123 :' + randomString(100),
          ':nick!user@host JOIN #channel ' + randomString(20) + ' :' + randomString(50),
        ];
        for (const line of extendedJoins) {
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on JOIN with malformed channel names', () => {
        setupMocks();

        const malformedChannels = ['', '#', '##', '#' + randomString(300), '# ', '#\x00', '#\x07'];
        for (const channel of malformedChannels) {
          const line = `:nick!user@host JOIN ${channel}`;
          // Kernel logs errors to Sentry and returns gracefully instead of throwing
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('PART fuzzing', () => {
      it('should not crash on fuzzed PART messages', () => {
        setupMocks();

        for (let i = 0; i < 50; i++) {
          const hasReason = Math.random() > 0.5;
          const reason = hasReason ? ' :' + randomString(Math.floor(Math.random() * 100)) : '';
          const line = `${randomTags()}:${randomHostmask()} PART ${randomChannel()}${reason}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on PART with various reason formats', () => {
        setupMocks();

        const reasons = ['', ' ', ' :', ' :reason', ' :' + randomString(500), ' :::', ' :\x01ACTION leaves\x01'];
        for (const reason of reasons) {
          const line = `:nick!user@host PART #channel${reason}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('KICK fuzzing', () => {
      it('should not crash on fuzzed KICK messages', () => {
        setupMocks();

        for (let i = 0; i < 50; i++) {
          const hasReason = Math.random() > 0.5;
          const reason = hasReason ? ' :' + randomString(Math.floor(Math.random() * 100)) : '';
          const line = `:${randomHostmask()} KICK ${randomChannel()} ${randomNick()}${reason}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on KICK with malformed parameters', () => {
        setupMocks();

        const malformedKicks = [
          ':nick!user@host KICK #channel',
          ':nick!user@host KICK #channel ',
          ':nick!user@host KICK  targetNick',
          ':nick!user@host KICK #channel targetNick :' + randomString(1000),
        ];
        for (const line of malformedKicks) {
          // Kernel logs errors to Sentry and returns gracefully instead of throwing
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('QUIT fuzzing', () => {
      it('should not crash on fuzzed QUIT messages', () => {
        setupMocks();

        for (let i = 0; i < 50; i++) {
          const hasReason = Math.random() > 0.5;
          const reason = hasReason ? ' :' + randomString(Math.floor(Math.random() * 100)) : '';
          const line = `${randomTags()}:${randomHostmask()} QUIT${reason}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('NICK fuzzing', () => {
      it('should not crash on fuzzed NICK messages', () => {
        setupMocks();

        for (let i = 0; i < 50; i++) {
          const newNick = randomString(Math.floor(Math.random() * 30) + 1);
          const line = `${randomTags()}:${randomHostmask()} NICK :${newNick}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on NICK with special characters', () => {
        setupMocks();

        const specialNicks = ['', ' ', '123', '[nick]', '{nick}', 'nick|away', 'nick_', 'nick-', randomString(100)];
        for (const nick of specialNicks) {
          const line = `:oldnick!user@host NICK :${nick}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('TOPIC fuzzing', () => {
      it('should not crash on fuzzed TOPIC messages', () => {
        setupMocks();

        for (let i = 0; i < 50; i++) {
          const topic = randomString(Math.floor(Math.random() * 300));
          const line = `${randomTags()}:${randomHostmask()} TOPIC ${randomChannel()} :${topic}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on TOPIC with special content', () => {
        setupMocks();

        const specialTopics = ['', ' ', '\x02bold\x02', '\x0304,01colored\x03', '\x1Funderline\x1F', '🔥🎉💻', randomString(1000)];
        for (const topic of specialTopics) {
          const line = `:nick!user@host TOPIC #channel :${topic}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('NOTICE fuzzing', () => {
      it('should not crash on fuzzed NOTICE messages', () => {
        setupMocks();

        for (let i = 0; i < 50; i++) {
          const target = Math.random() > 0.5 ? randomChannel() : randomNick();
          const message = randomString(Math.floor(Math.random() * 200));
          const line = `${randomMsgid()}:${randomHostmask()} NOTICE ${target} :${message}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('numeric reply fuzzing', () => {
      it('should not crash on fuzzed RPL_WELCOME (001)', () => {
        setupMocks();

        for (let i = 0; i < 20; i++) {
          const line = `:server 001 ${randomNick()} :Welcome to the ${randomString(20)} Network ${randomHostmask()}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on fuzzed RPL_ISUPPORT (005)', () => {
        setupMocks();

        const isupportTokens = [
          'CHANTYPES=#&',
          'CHANMODES=beI,k,l,imnpst',
          'PREFIX=(qaohv)~&@%+',
          'NETWORK=' + randomString(20),
          'CASEMAPPING=rfc1459',
          'NICKLEN=' + Math.floor(Math.random() * 50),
          'MODES=' + Math.floor(Math.random() * 20),
          'TOPICLEN=' + Math.floor(Math.random() * 1000),
          randomString(20) + '=' + randomString(30),
        ];
        for (let i = 0; i < 20; i++) {
          const tokens = Array(Math.floor(Math.random() * 10) + 1)
            .fill(0)
            .map(() => isupportTokens[Math.floor(Math.random() * isupportTokens.length)]);
          const line = `:server 005 nick ${tokens.join(' ')} :are supported by this server`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on fuzzed RPL_NAMREPLY (353)', () => {
        setupMocks();

        for (let i = 0; i < 20; i++) {
          const nicks = Array(Math.floor(Math.random() * 50) + 1)
            .fill(0)
            .map(() => randomNick());
          const line = `:server 353 mynick = ${randomChannel()} :${nicks.join(' ')}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on fuzzed RPL_TOPIC (332)', () => {
        setupMocks();

        for (let i = 0; i < 20; i++) {
          const line = `:server 332 nick ${randomChannel()} :${randomString(Math.floor(Math.random() * 300))}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on fuzzed RPL_WHOREPLY (352)', () => {
        setupMocks();

        for (let i = 0; i < 20; i++) {
          const flags = ['H', 'G', 'H*', 'G*', 'H@', 'G@', 'H+', 'G+'][Math.floor(Math.random() * 8)];
          const line = `:server 352 mynick ${randomChannel()} ~${randomString(10)} ${randomString(20)} server ${randomNick()} ${flags} :0 ${randomString(30)}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on fuzzed error numerics', () => {
        setupMocks();

        const errorNumerics = [
          '401', // ERR_NOSUCHNICK
          '403', // ERR_NOSUCHCHANNEL
          '404', // ERR_CANNOTSENDTOCHAN
          '421', // ERR_UNKNOWNCOMMAND
          '432', // ERR_ERRONEUSNICKNAME
          '433', // ERR_NICKNAMEINUSE
          '461', // ERR_NEEDMOREPARAMS
          '473', // ERR_INVITEONLYCHAN
          '474', // ERR_BANNEDFROMCHAN
          '475', // ERR_BADCHANNELKEY
          '482', // ERR_CHANOPRIVSNEEDED
        ];
        for (const numeric of errorNumerics) {
          for (let i = 0; i < 5; i++) {
            const line = `:server ${numeric} nick ${randomString(20)} :${randomString(50)}`;
            expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
          }
        }
      });

      it('should not crash on random numeric values', () => {
        setupMocks();

        for (let i = 0; i < 100; i++) {
          const numeric = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
          const line = `:server ${numeric} nick ${randomString(30)} :${randomString(100)}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('WHOIS reply fuzzing', () => {
      it('should not crash on fuzzed WHOIS replies', () => {
        setupMocks();

        const whoisNumerics = [
          { num: '311', format: (n: string) => `:server 311 me ${n} ~${randomString(10)} ${randomString(30)} * :${randomString(50)}` },
          { num: '312', format: (n: string) => `:server 312 me ${n} server.name :${randomString(30)}` },
          { num: '313', format: (n: string) => `:server 313 me ${n} :is an IRC Operator` },
          { num: '317', format: (n: string) => `:server 317 me ${n} ${Math.floor(Math.random() * 100000)} ${Math.floor(Date.now() / 1000)} :seconds idle, signon time` },
          { num: '318', format: (n: string) => `:server 318 me ${n} :End of /WHOIS list` },
          { num: '319', format: (n: string) => `:server 319 me ${n} :${Array(5).fill(0).map(() => randomChannel()).join(' ')}` },
          { num: '330', format: (n: string) => `:server 330 me ${n} ${randomString(15)} :is logged in as` },
          { num: '338', format: (n: string) => `:server 338 me ${n} ${randomString(15)} :actually using host` },
          { num: '378', format: (n: string) => `:server 378 me ${n} :is connecting from *@${randomString(30)}` },
          { num: '671', format: (n: string) => `:server 671 me ${n} :is using a secure connection` },
        ];

        for (let i = 0; i < 30; i++) {
          const nick = randomNick();
          for (const reply of whoisNumerics) {
            expect(() => new Kernel({ type: 'raw', line: reply.format(nick) }).handle()).not.toThrow();
          }
        }
      });
    });

    describe('CAP fuzzing', () => {
      it('should not crash on fuzzed CAP messages', () => {
        setupMocks();

        const capSubcommands = ['LS', 'LIST', 'REQ', 'ACK', 'NAK', 'NEW', 'DEL', 'END'];
        const capabilities = ['multi-prefix', 'away-notify', 'account-notify', 'extended-join', 'sasl', 'message-tags', 'batch', 'server-time', randomString(20)];

        for (let i = 0; i < 30; i++) {
          const subcommand = capSubcommands[Math.floor(Math.random() * capSubcommands.length)];
          const caps = Array(Math.floor(Math.random() * 10) + 1)
            .fill(0)
            .map(() => capabilities[Math.floor(Math.random() * capabilities.length)]);
          const line = `:server CAP * ${subcommand} :${caps.join(' ')}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on CAP with multiline indicator', () => {
        setupMocks();

        const lines = [':server CAP * LS * :cap1 cap2 cap3', ':server CAP * LS :cap4 cap5', ':server CAP nick LS * :' + randomString(200), ':server CAP nick LS :' + randomString(200)];
        for (const line of lines) {
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('BATCH fuzzing', () => {
      it('should not crash on fuzzed BATCH messages', () => {
        setupMocks();

        const batchTypes = ['chathistory', 'netjoin', 'netsplit', randomString(15)];

        for (let i = 0; i < 20; i++) {
          const batchId = randomString(20);
          const batchType = batchTypes[Math.floor(Math.random() * batchTypes.length)];
          const startLine = `:server BATCH +${batchId} ${batchType} ${randomChannel()}`;
          const endLine = `:server BATCH -${batchId}`;

          expect(() => new Kernel({ type: 'raw', line: startLine }).handle()).not.toThrow();
          expect(() => new Kernel({ type: 'raw', line: endLine }).handle()).not.toThrow();
        }
      });
    });

    describe('PING/PONG fuzzing', () => {
      it('should not crash on fuzzed PING messages', () => {
        setupMocks();

        for (let i = 0; i < 20; i++) {
          const pingData = randomString(Math.floor(Math.random() * 100));
          const line = `PING :${pingData}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on PING with various formats', () => {
        setupMocks();

        const pingFormats = ['PING :server', 'PING server', 'PING :' + randomString(500), 'PING', 'PING :', 'PING ::', ':server PING :client'];
        for (const line of pingFormats) {
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('ERROR fuzzing', () => {
      it('should not crash on fuzzed ERROR messages', () => {
        setupMocks();

        const errorMessages = [
          'ERROR :Closing Link: ' + randomString(30),
          'ERROR :' + randomString(200),
          'ERROR',
          'ERROR :',
          'ERROR ::',
          'ERROR :Banned',
          'ERROR :Connection timed out',
          'ERROR :Too many connections from your IP',
        ];
        for (const line of errorMessages) {
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('tag fuzzing', () => {
      it('should not crash on messages with malformed tags', () => {
        setupMocks();

        const malformedTags = [
          '@',
          '@ ',
          '@=',
          '@key',
          '@key=',
          '@=value',
          '@key=value=extra',
          '@;',
          '@;;',
          '@key=value;',
          '@;key=value',
          '@key=value;;key2=value2',
          '@' + randomString(1000),
          '@' + 'key=value;'.repeat(100),
        ];

        for (const tag of malformedTags) {
          const line = `${tag} :nick!user@host PRIVMSG #channel :message`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on tags with special values', () => {
        setupMocks();

        const specialTagValues = [
          '@time=invalid-time',
          '@time=2023-13-45T99:99:99.999Z',
          '@msgid=' + randomString(1000),
          '@account=',
          '@account=*',
          '@' + randomString(50) + '=' + randomString(100),
        ];

        for (const tag of specialTagValues) {
          const line = `${tag} :nick!user@host PRIVMSG #channel :message`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('sender fuzzing', () => {
      it('should not crash on malformed senders', () => {
        setupMocks();

        const malformedSenders = [
          ':',
          '::',
          ':nick',
          ':nick!',
          ':nick@',
          ':nick!user',
          ':nick!user@',
          ':!user@host',
          ':nick!@host',
          ':@host',
          ':' + randomString(500) + '!' + randomString(100) + '@' + randomString(200),
          ':\x00\x01\x02',
        ];

        for (const sender of malformedSenders) {
          const line = `${sender} PRIVMSG #channel :message`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('LIST fuzzing', () => {
      it('should not crash on fuzzed LIST replies (322)', () => {
        setupMocks();

        for (let i = 0; i < 20; i++) {
          const userCount = Math.floor(Math.random() * 10000);
          const topic = randomString(Math.floor(Math.random() * 300));
          const line = `:server 322 nick ${randomChannel()} ${userCount} :${topic}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on fuzzed ENDOFLIST (323)', () => {
        setupMocks();

        const lines = [':server 323 nick :End of /LIST', ':server 323 nick :' + randomString(100), ':server 323 ' + randomNick() + ' :End of LIST'];
        for (const line of lines) {
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('INVITE fuzzing', () => {
      it('should not crash on fuzzed INVITE messages', () => {
        setupMocks();

        for (let i = 0; i < 20; i++) {
          const line = `${randomMsgid()}:${randomHostmask()} INVITE ${randomNick()} ${randomChannel()}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });

    describe('ban list fuzzing', () => {
      it('should not crash on fuzzed ban list replies (367)', () => {
        setupMocks();

        for (let i = 0; i < 20; i++) {
          const banMask = '*!*@' + randomString(30);
          const setter = randomHostmask();
          const timestamp = Math.floor(Date.now() / 1000);
          const line = `:server 367 nick ${randomChannel()} ${banMask} ${setter} ${timestamp}`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });

      it('should not crash on malformed ban masks', () => {
        setupMocks();

        const malformedMasks = ['*', '*!*', '*!*@*', '', randomString(500), '!@', '*!*@', '@*'];
        for (const mask of malformedMasks) {
          const line = `:server 367 nick #channel ${mask} setter 1234567890`;
          expect(() => new Kernel({ type: 'raw', line }).handle()).not.toThrow();
        }
      });
    });
  });
});
