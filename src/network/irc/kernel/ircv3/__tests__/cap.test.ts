/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import * as networkFile from '@/network/irc/network';
import * as capabilitiesFile from '@/network/irc/capabilities';
import * as stsFile from '@/network/irc/sts';
import * as saslFile from '@/network/irc/sasl';
import * as stsStoreFile from '@/network/irc/store/stsStore';
import { DEBUG_CHANNEL } from '@/config/config';
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel ircv3/cap', () => {
  setupKernelTest();

  it('test CAP LS with STS saves SASL credentials before disconnect', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'setSupportedOption').mockImplementation(() => {});
    vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
    vi.spyOn(networkFile, 'ircRequestMetadata').mockImplementation(() => {});
    vi.spyOn(capabilitiesFile, 'parseCapabilityList').mockImplementation(() => ({
      sts: 'port=6697,duration=300',
    }));
    vi.spyOn(capabilitiesFile, 'addAvailableCapabilities').mockImplementation(() => {});
    vi.spyOn(stsFile, 'isCurrentConnectionSecure').mockImplementation(() => false);
    vi.spyOn(stsFile, 'getCurrentConnectionHost').mockImplementation(() => 'irc.test.com');
    vi.spyOn(stsFile, 'parseSTSValue').mockImplementation(() => ({
      port: 6697,
      duration: 300,
      preload: false,
    }));
    vi.spyOn(stsFile, 'createSTSPolicy').mockImplementation(() => ({
      host: 'irc.test.com',
      port: 6697,
      duration: 300,
      expiresAt: Date.now() + 300000,
    }));
    vi.spyOn(stsStoreFile, 'setSTSPolicy').mockImplementation(() => {});
    vi.spyOn(stsFile, 'setPendingSTSUpgrade').mockImplementation(() => {});
    const mockSaveSaslCredentials = vi.spyOn(saslFile, 'saveSaslCredentialsForReconnect').mockImplementation(async () => {});
    const mockIrcDisconnect = vi.spyOn(networkFile, 'ircDisconnect').mockImplementation(() => {});

    const line = ':irc.test.com CAP * LS :sts=port=6697,duration=300';
    new Kernel({ type: 'raw', line }).handle();

    // SASL credentials should be saved before disconnect
    expect(mockSaveSaslCredentials).toHaveBeenCalledTimes(1);
    expect(mockIrcDisconnect).toHaveBeenCalledTimes(1);
  });

  it('test CAP LS with STS triggers handleSocketClose directly after ircDisconnect', async () => {
    vi.useFakeTimers();
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'setSupportedOption').mockImplementation(() => {});
    vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
    vi.spyOn(networkFile, 'ircRequestMetadata').mockImplementation(() => {});
    vi.spyOn(capabilitiesFile, 'parseCapabilityList').mockImplementation(() => ({
      sts: 'port=6697,duration=300',
    }));
    vi.spyOn(capabilitiesFile, 'addAvailableCapabilities').mockImplementation(() => {});
    vi.spyOn(stsFile, 'isCurrentConnectionSecure').mockImplementation(() => false);
    vi.spyOn(stsFile, 'getCurrentConnectionHost').mockImplementation(() => 'irc.test.com');
    vi.spyOn(stsFile, 'parseSTSValue').mockImplementation(() => ({
      port: 6697,
      duration: 300,
      preload: false,
    }));
    vi.spyOn(stsFile, 'createSTSPolicy').mockImplementation(() => ({
      host: 'irc.test.com',
      port: 6697,
      duration: 300,
      expiresAt: Date.now() + 300000,
    }));
    vi.spyOn(stsStoreFile, 'setSTSPolicy').mockImplementation(() => {});
    vi.spyOn(stsFile, 'setPendingSTSUpgrade').mockImplementation(() => {});
    vi.spyOn(saslFile, 'saveSaslCredentialsForReconnect').mockImplementation(async () => {});
    vi.spyOn(networkFile, 'ircDisconnect').mockImplementation(() => {});

    // After ircDisconnect, handleSocketClose should run, which needs these:
    vi.spyOn(stsFile, 'getPendingSTSUpgrade').mockImplementation(() => ({
      host: 'irc.test.com',
      port: 6697,
      reason: 'sts_upgrade',
    }));
    vi.spyOn(stsFile, 'hasExhaustedSTSRetries').mockImplementation(() => false);
    const mockIncrementSTSRetries = vi.spyOn(stsFile, 'incrementSTSRetries').mockImplementation(() => {});
    const mockSetIsConnecting = vi.spyOn(settingsFile, 'setIsConnecting').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getServer').mockImplementation(() => ({
      default: 0,
      encoding: 'utf8',
      network: 'test',
      servers: ['irc.test.com'],
    }));
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'testNick');
    const mockRestoreSaslCredentials = vi.spyOn(saslFile, 'restoreSaslCredentials').mockImplementation(async () => true);
    const mockIrcConnectWithTLS = vi.spyOn(networkFile, 'ircConnectWithTLS').mockImplementation(() => {});

    const line = ':irc.test.com CAP * LS :sts=port=6697,duration=300';
    new Kernel({ type: 'raw', line }).handle();

    // handleSocketClose should have been called directly (not via onclose event)
    expect(mockIncrementSTSRetries).toHaveBeenCalledTimes(1);
    expect(mockSetIsConnecting).toHaveBeenCalledWith(true);

    // Advance past the setTimeout delay to trigger TLS reconnection
    await vi.advanceTimersByTimeAsync(1000);

    expect(mockRestoreSaslCredentials).toHaveBeenCalledTimes(1);
    expect(mockIrcConnectWithTLS).toHaveBeenCalledTimes(1);
    expect(mockIrcConnectWithTLS).toHaveBeenCalledWith(
      expect.objectContaining({ servers: ['irc.test.com'] }),
      'testNick',
      6697,
    );

    vi.useRealTimers();
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

  it('test raw CAP #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetSupportedOption = vi.spyOn(settingsFile, 'setSupportedOption').mockImplementation(() => {});
    const mockIrcRequestMetadata = vi.spyOn(networkFile, 'ircRequestMetadata').mockImplementation(() => {});
    const mockIrcSendRawMessage = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
    vi.spyOn(capabilitiesFile, 'parseCapabilityList').mockReturnValue({});
    vi.spyOn(capabilitiesFile, 'addAvailableCapabilities').mockImplementation(() => {});
    vi.spyOn(capabilitiesFile, 'getCapabilitiesToRequest').mockReturnValue([]);
    vi.spyOn(capabilitiesFile, 'markCapabilitiesRequested').mockImplementation(() => {});
    vi.spyOn(capabilitiesFile, 'setAwaitingMoreCaps').mockImplementation(() => {});
    const mockEndCapNegotiation = vi.spyOn(capabilitiesFile, 'endCapNegotiation').mockImplementation(() => {});

    const line = ':jowisz.pirc.pl CAP * LS :unrealircd.org/json-log';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetSupportedOption).toBeCalledTimes(0);
    expect(mockIrcRequestMetadata).toBeCalledTimes(0);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);

    // No capabilities to request, so CAP negotiation should end
    expect(mockEndCapNegotiation).toHaveBeenCalledTimes(1);
    expect(mockIrcSendRawMessage).toHaveBeenCalledWith('CAP END');
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
});
