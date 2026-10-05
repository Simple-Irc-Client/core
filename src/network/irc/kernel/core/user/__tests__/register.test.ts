/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import * as networkFile from '@/network/irc/network';
import * as stsFile from '@/network/irc/sts';
import i18next from '@/app/i18n';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { useFriendsStore } from '@features/friends/store/friends';
import { resetFriendsSubscription } from '@features/friends/friends';
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel core/user/register', () => {
  setupKernelTest();

  it('test connected', () => {
    const mockSetIsConnecting = vi.spyOn(settingsFile, 'setIsConnecting').mockImplementation(() => {});
    const mockSetIsConnected = vi.spyOn(settingsFile, 'setIsConnected').mockImplementation(() => {});
    const mockSetConnectedTime = vi.spyOn(settingsFile, 'setConnectedTime').mockImplementation(() => {});
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});

    new Kernel({ type: 'raw', line: ':srv 001 TestNick :Welcome' }).handle();

    expect(mockSetIsConnecting).toBeCalledWith(false);
    expect(mockSetIsConnected).toBeCalledWith(true);
    expect(mockSetConnectedTime).toBeCalledTimes(1);
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledWith(expect.objectContaining({ message: i18next.t('kernel.connected') }));
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledTimes(1);
  });

  it('test end of MOTD (376) subscribes persisted friends once per connection', () => {
    vi.spyOn(settingsFile, 'setIsConnecting').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'setIsConnected').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'setConnectedTime').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getServer').mockImplementation(
      () => ({ network: 'testnet' }) as unknown as ReturnType<typeof settingsFile.getServer>,
    );
    vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 128);
    vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
    const mockMonitorAdd = vi.spyOn(networkFile, 'ircMonitorAdd').mockImplementation(() => {});

    useFriendsStore.setState({ friendsByNetwork: { testnet: ['Alice', 'Bob'] } });
    resetFriendsSubscription();

    new Kernel({ type: 'raw', line: ':srv 001 TestNick :Welcome' }).handle();
    new Kernel({ type: 'raw', line: ':srv 376 TestNick :End of /MOTD command.' }).handle();
    // A manual /MOTD replays 376 — must not resend the list on this connection
    new Kernel({ type: 'raw', line: ':srv 376 TestNick :End of /MOTD command.' }).handle();

    expect(mockMonitorAdd).toHaveBeenCalledTimes(1);
    expect(mockMonitorAdd).toHaveBeenCalledWith(['Alice', 'Bob']);

    // A reconnect's fresh 001 re-arms the subscription
    new Kernel({ type: 'raw', line: ':srv 001 TestNick :Welcome' }).handle();
    new Kernel({ type: 'raw', line: ':srv 376 TestNick :End of /MOTD command.' }).handle();

    expect(mockMonitorAdd).toHaveBeenCalledTimes(2);

    useFriendsStore.setState({ friendsByNetwork: {} });
  });

  it('test missing MOTD (422) also subscribes persisted friends', () => {
    vi.spyOn(settingsFile, 'setIsConnecting').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'setIsConnected').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'setConnectedTime').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getServer').mockImplementation(
      () => ({ network: 'testnet' }) as unknown as ReturnType<typeof settingsFile.getServer>,
    );
    vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 128);
    vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
    const mockMonitorAdd = vi.spyOn(networkFile, 'ircMonitorAdd').mockImplementation(() => {});

    useFriendsStore.setState({ friendsByNetwork: { testnet: ['Alice'] } });
    resetFriendsSubscription();

    new Kernel({ type: 'raw', line: ':srv 001 TestNick :Welcome' }).handle();
    new Kernel({ type: 'raw', line: ':srv 422 TestNick :MOTD File is missing' }).handle();

    expect(mockMonitorAdd).toHaveBeenCalledWith(['Alice']);

    useFriendsStore.setState({ friendsByNetwork: {} });
  });

  it('test connected starts the active keepalive', () => {
    vi.spyOn(settingsFile, 'setIsConnecting').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'setIsConnected').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'setConnectedTime').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    const mockStartKeepalive = vi.spyOn(networkFile, 'startKeepalive').mockImplementation(() => {});

    new Kernel({ type: 'raw', line: ':srv 001 TestNick :Welcome' }).handle();

    expect(mockStartKeepalive).toHaveBeenCalledTimes(1);
  });

  it('test connected clears pending STS upgrade', () => {
    const mockSetIsConnecting = vi.spyOn(settingsFile, 'setIsConnecting').mockImplementation(() => {});
    const mockSetIsConnected = vi.spyOn(settingsFile, 'setIsConnected').mockImplementation(() => {});
    const mockSetConnectedTime = vi.spyOn(settingsFile, 'setConnectedTime').mockImplementation(() => {});
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    const mockClearPendingSTSUpgrade = vi.spyOn(stsFile, 'clearPendingSTSUpgrade').mockImplementation(() => {});
    const mockResetSTSRetries = vi.spyOn(stsFile, 'resetSTSRetries').mockImplementation(() => {});

    new Kernel({ type: 'raw', line: ':srv 001 TestNick :Welcome' }).handle();

    expect(mockSetIsConnecting).toBeCalledWith(false);
    expect(mockSetIsConnected).toBeCalledWith(true);
    expect(mockSetConnectedTime).toBeCalledTimes(1);
    // Should clear STS state on successful connection
    expect(mockClearPendingSTSUpgrade).toHaveBeenCalledTimes(1);
    expect(mockResetSTSRetries).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledWith(expect.objectContaining({ message: i18next.t('kernel.connected') }));
  });

  it('test raw 001 should persist server-confirmed nick', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'RequestedNick');
    const mockSetNick = vi.spyOn(settingsFile, 'setNick').mockImplementation(() => {});

    const line = ':netsplit.pirc.pl 001 RequestedNick_ :Welcome to the pirc.pl IRC Network RequestedNick_!~user@1.1.1.1';

    new Kernel({ type: 'raw', line }).handle();

    // Server assigned a different nick (RequestedNick_ instead of RequestedNick)
    expect(mockSetNick).toHaveBeenCalledTimes(1);
    expect(mockSetNick).toHaveBeenCalledWith('RequestedNick_');
  });

  it('test raw 001 should not call setNick when nick matches', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'Merovingian');
    const mockSetNick = vi.spyOn(settingsFile, 'setNick').mockImplementation(() => {});

    const line = ':netsplit.pirc.pl 001 Merovingian :Welcome to the pirc.pl IRC Network Merovingian!~user@1.1.1.1';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetNick).not.toHaveBeenCalled();
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

  it('test raw 396', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':chmurka.pirc.pl 396 sic-test A.A.A.IP :is now your displayed host';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'A.A.A.IP is now your displayed host' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

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

  it('test raw 464 - password incorrect', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getIsWizardCompleted').mockReturnValue(true);

    const line = ':server.irc.net 464 sic-test :Password incorrect';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: i18next.t('kernel.464.password-incorrect') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });
});
