/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import * as networkFile from '@/network/irc/network';
import * as stsFile from '@/network/irc/sts';
import * as saslFile from '@/network/irc/sasl';
import i18next from '@/app/i18n';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { ChannelCategory } from '@shared/types';
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel connection', () => {
  setupKernelTest();

  it('test connect sends the registration burst (CAP LS / NICK / USER)', () => {
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestNick');
    vi.spyOn(settingsFile, 'getServer').mockImplementation(() => undefined);
    const mockSend = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});

    new Kernel({ type: 'connect' }).handle();

    // The kernel — not the transport — opens registration on connect.
    expect(mockSend).toHaveBeenCalledWith('CAP LS 302');
    expect(mockSend).toHaveBeenCalledWith('NICK TestNick');
    expect(mockSend).toHaveBeenCalledWith('USER TestNick 0 * :TestNick');
    // No server password configured -> no PASS line.
    expect(mockSend).not.toHaveBeenCalledWith(expect.stringMatching(/^PASS /));
  });

  it('test connect sends PASS before NICK when server has a password', () => {
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestNick');
    vi.spyOn(settingsFile, 'getServer').mockImplementation(
      () => ({ serverPassword: 'sekret' }) as unknown as ReturnType<typeof settingsFile.getServer>,
    );
    const mockSend = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});

    new Kernel({ type: 'connect' }).handle();

    expect(mockSend).toHaveBeenCalledWith('PASS sekret');
    const calls = mockSend.mock.calls.map((c) => c[0] as string);
    expect(calls.indexOf('PASS sekret')).toBeLessThan(calls.indexOf('NICK TestNick'));
  });

  describe('view on connect', () => {
    const stubConnect = () => {
      vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestNick');
      vi.spyOn(settingsFile, 'getServer').mockImplementation(() => undefined);
      vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
      return vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
    };

    it('defaults the view to Status on a fresh connect (nothing else restored)', () => {
      const mockSetCurrentChannelName = stubConnect();
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => STATUS_CHANNEL);
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => false);

      new Kernel({ type: 'connect' }).handle();

      expect(mockSetCurrentChannelName).toHaveBeenCalledWith(STATUS_CHANNEL, ChannelCategory.status);
    });

    it('does not steal the view from a channel/DM the user is already reading', () => {
      const mockSetCurrentChannelName = stubConnect();
      // A restored persisted window (mobile: the webview reloaded in the
      // background, so this "Connect" tap arrives as a fresh first connect) or
      // a plain reconnect mid-conversation — either way the user is on a real
      // window and must stay there.
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => 'Bfyhdgbfcgjbv');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation((name: string) => name === 'Bfyhdgbfcgjbv');

      new Kernel({ type: 'connect' }).handle();

      expect(mockSetCurrentChannelName).not.toHaveBeenCalled();
    });

    it('falls back to Status when the current window no longer exists', () => {
      const mockSetCurrentChannelName = stubConnect();
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#gone');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => false);

      new Kernel({ type: 'connect' }).handle();

      expect(mockSetCurrentChannelName).toHaveBeenCalledWith(STATUS_CHANNEL, ChannelCategory.status);
    });

    it('does not force the view back to Status on a reconnect mid-conversation', () => {
      const mockSetCurrentChannelName = stubConnect();
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#sic');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation((name: string) => name === '#sic');

      // First connect, then the socket drops and reconnects (or an STS upgrade
      // reconnects it): the transport 'connect' event fires again.
      new Kernel({ type: 'connect' }).handle();
      new Kernel({ type: 'connect' }).handle();

      expect(mockSetCurrentChannelName).not.toHaveBeenCalledWith(STATUS_CHANNEL, ChannelCategory.status);
    });
  });

  it('test close stops the active keepalive', () => {
    vi.spyOn(settingsFile, 'setIsConnecting').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'setIsConnected').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    const mockStopKeepalive = vi.spyOn(networkFile, 'stopKeepalive').mockImplementation(() => {});

    new Kernel({ type: 'close' }).handle();

    expect(mockStopKeepalive).toHaveBeenCalled();
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

  it('test error surfaces the reason in the status window', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    new Kernel({ type: 'error', line: 'TLS error: cert expired' }).handle();

    expect(mockSetAddMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        target: 'Status',
        message: 'TLS error: cert expired',
        category: 'error',
      }),
    );
  });

  it('test close during reconnection should call handleReconnectFailure instead of showing disconnected', () => {
    const mockSetIsConnecting = vi.spyOn(settingsFile, 'setIsConnecting').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'setIsConnected').mockImplementation(() => {});
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    vi.spyOn(networkFile, 'getIsReconnecting').mockImplementation(() => true);
    const mockHandleReconnectFailure = vi.spyOn(networkFile, 'handleReconnectFailure').mockImplementation(() => {});

    new Kernel({ type: 'close' }).handle();

    // Should NOT show disconnected message or update connection state
    expect(mockSetIsConnecting).not.toHaveBeenCalled();
    expect(mockSetAddMessageToAllChannels).not.toHaveBeenCalled();
    // Should delegate to handleReconnectFailure
    expect(mockHandleReconnectFailure).toHaveBeenCalledTimes(1);
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

    new Kernel({ type: 'close' }).handle(); // pending STS upgrade -> delegates to handleSocketClose

    expect(mockGetPendingSTSUpgrade).toHaveBeenCalled();
    expect(mockIncrementSTSRetries).toHaveBeenCalledTimes(1);
    // Should NOT clear pending upgrade - handleDisconnected needs it
    expect(mockClearPendingSTSUpgrade).not.toHaveBeenCalled();
    expect(mockSetIsConnecting).toBeCalledWith(true);
  });

  it('test socket close during STS upgrade restores SASL credentials before reconnect', async () => {
    vi.useFakeTimers();
    const mockSetIsConnecting = vi.spyOn(settingsFile, 'setIsConnecting').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getServer').mockImplementation(() => ({
      network: 'TestNetwork',
      servers: ['irc.test.com:6667'],
      default: 0,
      encoding: 'utf-8',
    }));
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'TestUser');
    vi.spyOn(stsFile, 'getPendingSTSUpgrade').mockImplementation(() => ({
      host: 'irc.test.com',
      port: 6697,
      reason: 'sts_upgrade',
    }));
    vi.spyOn(stsFile, 'incrementSTSRetries').mockImplementation(() => {});
    vi.spyOn(stsFile, 'hasExhaustedSTSRetries').mockImplementation(() => false);
    const mockRestoreSaslCredentials = vi.spyOn(saslFile, 'restoreSaslCredentials').mockImplementation(async () => true);
    const mockIrcConnectWithTLS = vi.spyOn(networkFile, 'ircConnectWithTLS').mockImplementation(() => {});

    new Kernel({ type: 'close' }).handle(); // pending STS upgrade -> delegates to handleSocketClose

    expect(mockSetIsConnecting).toBeCalledWith(true);

    // Advance past the setTimeout delay (async because callback is async)
    await vi.advanceTimersByTimeAsync(1000);

    // SASL credentials should be restored before TLS reconnect
    expect(mockRestoreSaslCredentials).toHaveBeenCalledTimes(1);
    expect(mockIrcConnectWithTLS).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('test close during STS upgrade restores SASL credentials before reconnect', async () => {
    vi.useFakeTimers();
    const mockSetIsConnecting = vi.spyOn(settingsFile, 'setIsConnecting').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'setIsConnected').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    vi.spyOn(stsFile, 'getPendingSTSUpgrade').mockImplementation(() => ({
      host: 'irc.test.com',
      port: 6697,
      reason: 'sts_upgrade',
    }));
    vi.spyOn(stsFile, 'incrementSTSRetries').mockImplementation(() => {});
    vi.spyOn(stsFile, 'hasExhaustedSTSRetries').mockImplementation(() => false);
    vi.spyOn(settingsFile, 'getServer').mockImplementation(() => ({
      default: 0,
      encoding: 'utf8',
      network: 'test',
      servers: ['irc.test.com'],
    }));
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'testNick');
    const mockRestoreSaslCredentials = vi.spyOn(saslFile, 'restoreSaslCredentials').mockImplementation(async () => true);
    const mockIrcConnectWithTLS = vi.spyOn(networkFile, 'ircConnectWithTLS').mockImplementation(() => {});

    new Kernel({ type: 'close' }).handle();

    expect(mockSetIsConnecting).toBeCalledWith(true);

    // Advance past the setTimeout delay (async because callback is async)
    await vi.advanceTimersByTimeAsync(1000);

    // SASL credentials should be restored before TLS reconnect
    expect(mockRestoreSaslCredentials).toHaveBeenCalledTimes(1);
    expect(mockIrcConnectWithTLS).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
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

  describe('auto-rejoin channels on reconnect', () => {
    it('should auto-rejoin channels on connected when wizard is completed', () => {
      vi.spyOn(settingsFile, 'setIsConnecting').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setIsConnected').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setConnectedTime').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'getChannelsToAutoJoin').mockImplementation(() => ['#test', '#general']);
      vi.spyOn(settingsFile, 'getIsWizardCompleted').mockImplementation(() => true);
      const mockIrcJoinChannels = vi.spyOn(networkFile, 'ircJoinChannels').mockImplementation(() => {});

      new Kernel({ type: 'raw', line: ':srv 001 TestNick :Welcome' }).handle();

      expect(mockIrcJoinChannels).toHaveBeenCalledTimes(1);
      expect(mockIrcJoinChannels).toHaveBeenCalledWith(['#test', '#general']);
    });

    it('should not auto-rejoin channels when wizard is not completed', () => {
      vi.spyOn(settingsFile, 'setIsConnecting').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setIsConnected').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setConnectedTime').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'getChannelsToAutoJoin').mockImplementation(() => ['#test', '#general']);
      vi.spyOn(settingsFile, 'getIsWizardCompleted').mockImplementation(() => false);
      const mockIrcJoinChannels = vi.spyOn(networkFile, 'ircJoinChannels').mockImplementation(() => {});

      new Kernel({ type: 'raw', line: ':srv 001 TestNick :Welcome' }).handle();

      expect(mockIrcJoinChannels).not.toHaveBeenCalled();
    });

    it('should not call ircJoinChannels when no channels to auto-join', () => {
      vi.spyOn(settingsFile, 'setIsConnecting').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setIsConnected').mockImplementation(() => {});
      vi.spyOn(settingsFile, 'setConnectedTime').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
      vi.spyOn(channelsFile, 'getChannelsToAutoJoin').mockImplementation(() => []);
      vi.spyOn(settingsFile, 'getIsWizardCompleted').mockImplementation(() => true);
      const mockIrcJoinChannels = vi.spyOn(networkFile, 'ircJoinChannels').mockImplementation(() => {});

      new Kernel({ type: 'raw', line: ':srv 001 TestNick :Welcome' }).handle();

      expect(mockIrcJoinChannels).not.toHaveBeenCalled();
    });
  });
});
