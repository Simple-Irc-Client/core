/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as channelsFile from '@features/channels/store/channels';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';
import { clearBouncerBind } from '@/network/irc/bouncer';
import { markCapabilitiesAcknowledged, resetCapabilityState } from '@/network/irc/capabilities';
import * as networkFile from '@/network/irc/network';
import * as networksStore from '@features/networks/store/networks';

describe('kernel ircv3/sasl', () => {
  setupKernelTest();

  it('test raw 908 - SASL mechanisms', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':server.irc.net 908 sic-test PLAIN,EXTERNAL :are available SASL mechanisms';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: expect.stringContaining('PLAIN') }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('binds a bouncer connection to its network once logged in, before ending negotiation', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(networksStore, 'getIsConnected').mockImplementation(() => false);
    vi.spyOn(networksStore, 'getServer').mockImplementation(() => ({
      default: 0,
      encoding: 'utf8',
      network: 'bouncer',
      servers: ['bouncer.example.net'],
      bouncer: { account: 'alice', encryptedPassword: 'x', networkId: '1' },
    }));
    const send = vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
    clearBouncerBind();
    resetCapabilityState();
    markCapabilitiesAcknowledged(['sasl', 'soju.im/bouncer-networks']);

    new Kernel({ type: 'raw', line: ':soju.test 903 * :SASL authentication successful' }).handle();

    const sent = send.mock.calls.map(([line]) => line);
    expect(sent).toEqual(['BOUNCER BIND 1', 'CAP END']);
  });
});
