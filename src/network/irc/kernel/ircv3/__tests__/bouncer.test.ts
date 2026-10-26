/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import { parseNetworkAttributes } from '@/network/irc/kernel/ircv3/bouncer';
import * as channelsFile from '@features/channels/store/channels';
import { clearBouncerNetworks, getBoundBouncerNetworkId, useBouncerNetworksStore } from '@features/bouncer/store/bouncerNetworks';
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';
import { testSlice } from '@/test/networks';

const networks = () => testSlice(useBouncerNetworksStore).networks;

const handle = (line: string): void => {
  new Kernel({ type: 'raw', line }).handle();
};

describe('kernel ircv3/bouncer', () => {
  setupKernelTest();

  beforeEach(() => {
    clearBouncerNetworks();
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
  });

  describe('parseNetworkAttributes', () => {
    it('reads tag-encoded values and attributes without a value as removed', () => {
      expect(parseNetworkAttributes('name=Libera\\sChat;port=6697;error;;state=connected')).toEqual({
        name: 'Libera Chat',
        port: '6697',
        error: undefined,
        state: 'connected',
      });
    });

    it('keeps an equals sign inside a value', () => {
      expect(parseNetworkAttributes('pass=a=b')).toEqual({ pass: 'a=b' });
    });
  });

  it('adds a network the bouncer reports', () => {
    handle(':soju.test BOUNCER NETWORK 1 name=ergo-net;state=connected;host=ergo;port=6667');

    expect(networks()).toEqual([{ id: '1', attributes: { name: 'ergo-net', state: 'connected', host: 'ergo', port: '6667' } }]);
  });

  it('applies an update to what changed, removing attributes without a value', () => {
    handle(':soju.test BOUNCER NETWORK 1 name=ergo-net;state=disconnected;error=connection\\srefused');

    handle(':soju.test BOUNCER NETWORK 1 state=connected;error');

    expect(networks()).toEqual([{ id: '1', attributes: { name: 'ergo-net', state: 'connected' } }]);
  });

  it('removes a network deleted on the bouncer', () => {
    handle(':soju.test BOUNCER NETWORK 1 name=one');
    handle(':soju.test BOUNCER NETWORK 2 name=two');

    handle(':soju.test BOUNCER NETWORK 1 *');

    expect(networks()).toEqual([{ id: '2', attributes: { name: 'two' } }]);
  });

  it('takes the list sent in a soju.im/bouncer-networks batch', () => {
    handle(':soju.test BATCH +4 soju.im/bouncer-networks');
    handle('@batch=4 :soju.test BOUNCER NETWORK 1 name=one;state=connected');
    handle('@batch=4 :soju.test BOUNCER NETWORK 2 name=two;state=disconnected');
    expect(networks()).toEqual([]);

    handle(':soju.test BATCH -4');

    expect(networks().map((network) => network.id)).toEqual(['1', '2']);
  });

  it('leaves the replies to network changes to the NETWORK line that follows them', () => {
    handle(':soju.test BOUNCER ADDNETWORK 3');
    handle(':soju.test BOUNCER CHANGENETWORK 3');
    handle(':soju.test BOUNCER DELNETWORK 3');

    expect(networks()).toEqual([]);
  });

  it('ignores a NETWORK line without attributes', () => {
    handle(':soju.test BOUNCER NETWORK 1');
    handle(':soju.test BOUNCER NETWORK');

    expect(networks()).toEqual([]);
  });

  it('notes the network the connection is bound to from ISUPPORT', () => {
    handle(':soju.test 005 sojunick AWAYLEN=390 BOUNCER_NETID=1 CASEMAPPING=ascii :are supported');

    expect(getBoundBouncerNetworkId()).toBe('1');
  });

  it('has no bound network on the bouncer\'s own connection', () => {
    handle(':soju.test 005 tester BOT=B CASEMAPPING=ascii CHANTYPES= :are supported');

    expect(getBoundBouncerNetworkId()).toBeUndefined();
  });
});
