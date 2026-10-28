import { describe, expect, it, beforeEach } from 'vitest';
import { ChannelCategory } from '@shared/types';
import {
  activateNetwork,
  deactivateNetwork,
  getActiveNetworkId,
  getActiveSession,
  getChannelModes,
  getChannelTypes,
  getConnectedTime,
  getCurrentChannelCategory,
  getCurrentChannelName,
  getCurrentNick,
  getCurrentUserFlags,
  getMonitorLimit,
  getServer,
  getSilenceLimit,
  getUserModes,
  getWatchLimit,
  isSupportedOption,
  NO_NETWORK,
  resetConnectionSession,
  setChannelModes,
  setChannelTypes,
  setConnectedTime,
  setCurrentUserAvatar,
  setCurrentUserColor,
  setCurrentUserDisplayName,
  setCurrentUserFlag,
  setCurrentUserHomepage,
  setCurrentUserStatus,
  setCurrentWindow,
  setIsAutoAway,
  setIsConnected,
  setIsConnecting,
  setListRequestRemainingSeconds,
  setMonitorLimit,
  setNetworkName,
  setNick,
  setSilenceLimit,
  setSupportedOption,
  setUserModes,
  setWantedNick,
  setWatchLimit,
  useNetworksStore,
} from '../networks';
import { connectTestNetwork, resetNetworks, TEST_SERVER } from '@/test/networks';

const OTHER_SERVER = { default: 0, encoding: 'utf8', network: 'OtherNet', servers: ['irc.other.net'] };

const savedNetworks = (): { state: { activeNetworkId?: string; sessions: Record<string, Record<string, unknown>> } } =>
  JSON.parse(localStorage.getItem('sic-networks') ?? '{}');

describe('networks store', () => {
  beforeEach(() => {
    resetNetworks();
    // Nothing saved yet, as on the first start of a new version
    localStorage.clear();
  });

  describe('before a network is chosen', () => {
    it('has no network and no server', () => {
      expect(getActiveNetworkId()).toBe(NO_NETWORK);
      expect(getServer()).toBeUndefined();
      expect(getCurrentNick()).toBe('');
    });

    it('keeps what is set on the session of no network, without saving it', () => {
      setNick('early');

      expect(getCurrentNick()).toBe('early');
      expect(savedNetworks().state.sessions).toEqual({});
    });
  });

  describe('activateNetwork', () => {
    it('makes the network of the server the active one, as the nick', () => {
      activateNetwork(TEST_SERVER, 'alice');

      expect(getActiveNetworkId()).toBe('TestNet');
      expect(getServer()).toEqual(TEST_SERVER);
      expect(getCurrentNick()).toBe('alice');
    });

    it('keeps each network on a bouncer apart', () => {
      activateNetwork({ ...TEST_SERVER, bouncer: { account: 'a', encryptedPassword: 'x', networkId: '7' } }, 'alice');

      expect(getActiveNetworkId()).toBe('TestNet/bouncer:7');
    });

    it('treats every server of a network as that network', () => {
      activateNetwork({ ...TEST_SERVER, servers: ['irc1.test.net', 'irc2.test.net'], default: 1 }, 'alice');

      expect(getActiveNetworkId()).toBe('TestNet');
    });

    it('starts the new connection afresh, keeping the window the user was in', () => {
      activateNetwork(TEST_SERVER, 'alice');
      setIsConnected(true);
      setNetworkName('Test Network');
      setCurrentWindow('#chat', ChannelCategory.channel);
      activateNetwork(OTHER_SERVER, 'alice');

      activateNetwork(TEST_SERVER, 'alice');

      expect(getActiveSession().isConnected).toBe(false);
      expect(getActiveSession().networkName).toBeUndefined();
      expect(getCurrentChannelName()).toBe('#chat');
    });

    it('leaves the session of the network before as it was', () => {
      activateNetwork(TEST_SERVER, 'alice');
      setWantedNick('alice');

      activateNetwork(OTHER_SERVER, 'bob');

      expect(useNetworksStore.getState().sessions.TestNet?.wantedNick).toBe('alice');
      expect(getCurrentNick()).toBe('bob');
    });
  });

  describe('deactivateNetwork', () => {
    it('leaves no network active, with the sessions kept', () => {
      activateNetwork(TEST_SERVER, 'alice');

      deactivateNetwork();

      expect(getActiveNetworkId()).toBe(NO_NETWORK);
      expect(getServer()).toBeUndefined();
      expect(useNetworksStore.getState().sessions.TestNet?.nick).toBe('alice');
    });
  });

  describe('resetConnectionSession', () => {
    it('forgets what the connection learned, but not the nick or the window', () => {
      connectTestNetwork(TEST_SERVER, 'alice');
      setIsConnected(true);
      setCurrentUserFlag('away', true);
      setIsAutoAway(true);
      setCurrentWindow('#chat', ChannelCategory.channel);

      resetConnectionSession();

      expect(getActiveSession().isConnected).toBe(false);
      expect(getCurrentUserFlags()).toEqual([]);
      expect(getActiveSession().isAutoAway).toBe(false);
      expect(getCurrentNick()).toBe('alice');
      expect(getCurrentChannelName()).toBe('#chat');
    });
  });

  describe('connection state', () => {
    beforeEach(() => {
      connectTestNetwork();
    });

    it('sets connecting and connected', () => {
      setIsConnecting(true);
      setIsConnected(true);

      expect(getActiveSession().isConnecting).toBe(true);
      expect(getActiveSession().isConnected).toBe(true);
    });

    it('sets the connected time', () => {
      setConnectedTime(123);

      expect(getConnectedTime()).toBe(123);
    });

    it('sets the list request delay', () => {
      setListRequestRemainingSeconds(60);

      expect(getActiveSession().listRequestRemainingSeconds).toBe(60);
    });
  });

  describe('nick change clears the own metadata', () => {
    beforeEach(() => {
      connectTestNetwork(TEST_SERVER, 'OldNick');
      setCurrentUserAvatar('https://example.com/avatar.png');
      setCurrentUserDisplayName('Old Display Name');
      setCurrentUserStatus('Away');
      setCurrentUserHomepage('https://example.com');
      setCurrentUserColor('#ff5500');
    });

    it('clears it when the nick changes', () => {
      setNick('NewNick');

      const session = getActiveSession();
      expect(session.nick).toBe('NewNick');
      expect(session.currentUserAvatar).toBeUndefined();
      expect(session.currentUserDisplayName).toBeUndefined();
      expect(session.currentUserStatus).toBeUndefined();
      expect(session.currentUserHomepage).toBeUndefined();
      expect(session.currentUserColor).toBeUndefined();
    });

    it('keeps it when the nick stays the same', () => {
      setNick('OldNick');

      expect(getActiveSession().currentUserAvatar).toBe('https://example.com/avatar.png');
      expect(getActiveSession().currentUserColor).toBe('#ff5500');
    });
  });

  describe('windows', () => {
    beforeEach(() => {
      connectTestNetwork();
    });

    it('starts in Status', () => {
      expect(getCurrentChannelName()).toBe('Status');
      expect(getCurrentChannelCategory()).toBe(ChannelCategory.status);
    });

    it('remembers the window switched to', () => {
      setCurrentWindow('#chan', ChannelCategory.channel);

      expect(getCurrentChannelName()).toBe('#chan');
      expect(getCurrentChannelCategory()).toBe(ChannelCategory.channel);
    });

    it('uses the server\'s channel types, and the usual ones before 005 arrives', () => {
      expect(getChannelTypes()).toEqual(['#', '&']);

      setChannelTypes(['#']);

      expect(getChannelTypes()).toEqual(['#']);
    });
  });

  describe('what the server announces', () => {
    beforeEach(() => {
      connectTestNetwork();
    });

    it('keeps the user and channel modes', () => {
      setUserModes([{ symbol: '@', flag: 'o' }]);
      setChannelModes({ A: ['b'], B: ['k'], C: ['l'], D: ['n'] });

      expect(getUserModes()).toEqual([{ symbol: '@', flag: 'o' }]);
      expect(getChannelModes()).toEqual({ A: ['b'], B: ['k'], C: ['l'], D: ['n'] });
    });

    it('accumulates supported options in a new array each time', () => {
      setSupportedOption('WHOX');
      const before = getActiveSession().supportedOptions;
      setSupportedOption('MONITOR');

      expect(isSupportedOption('WHOX')).toBe(true);
      expect(isSupportedOption('MONITOR')).toBe(true);
      expect(isSupportedOption('WATCH')).toBe(false);
      expect(getActiveSession().supportedOptions).not.toBe(before);
    });

    it('adds and removes the own flags', () => {
      setCurrentUserFlag('r', true);
      setCurrentUserFlag('x', true);
      setCurrentUserFlag('r', false);

      expect(getCurrentUserFlags()).toEqual(['x']);
    });

    it('keeps the limits, which start at 0', () => {
      expect(getWatchLimit()).toBe(0);

      setWatchLimit(100);
      setMonitorLimit(200);
      setSilenceLimit(50);

      expect(getWatchLimit()).toBe(100);
      expect(getMonitorLimit()).toBe(200);
      expect(getSilenceLimit()).toBe(50);
    });
  });

  describe('persistence', () => {
    it('saves each network\'s server, nick and window, and which one is active', () => {
      activateNetwork(TEST_SERVER, 'alice');
      setWantedNick('alice_wanted');
      setCurrentWindow('#chat', ChannelCategory.channel);
      activateNetwork(OTHER_SERVER, 'bob');

      const saved = savedNetworks().state;
      expect(saved.activeNetworkId).toBe('OtherNet');
      expect(saved.sessions.TestNet).toEqual({
        server: TEST_SERVER,
        nick: 'alice',
        wantedNick: 'alice_wanted',
        currentChannelName: '#chat',
        currentChannelCategory: ChannelCategory.channel,
      });
    });

    it('does not save what a connection learned', () => {
      activateNetwork(TEST_SERVER, 'alice');
      setIsConnected(true);
      setConnectedTime(123);

      expect(savedNetworks().state.sessions.TestNet).not.toHaveProperty('isConnected');
      expect(savedNetworks().state.sessions.TestNet).not.toHaveProperty('connectedTime');
    });

    it('restores the sessions as they were, not connected', async () => {
      localStorage.setItem('sic-networks', JSON.stringify({
        state: { activeNetworkId: 'TestNet', sessions: { TestNet: { server: TEST_SERVER, nick: 'alice', wantedNick: undefined, currentChannelName: '#chat', currentChannelCategory: ChannelCategory.channel } } },
        version: 1,
      }));

      await useNetworksStore.persist.rehydrate();

      expect(getServer()).toEqual(TEST_SERVER);
      expect(getCurrentNick()).toBe('alice');
      expect(getCurrentChannelName()).toBe('#chat');
      expect(getActiveSession().isConnected).toBe(false);
      expect(getActiveSession().nickLenLimit).toBe(50);
    });

    it('takes the session an older version kept in the settings', async () => {
      localStorage.setItem('sic-settings', JSON.stringify({
        state: { nick: 'alice', server: TEST_SERVER, currentChannelName: '#old', currentChannelCategory: ChannelCategory.channel },
        version: 4,
      }));

      await useNetworksStore.persist.rehydrate();

      expect(getActiveNetworkId()).toBe('TestNet');
      expect(getCurrentNick()).toBe('alice');
      expect(getCurrentChannelName()).toBe('#old');
    });

    it('has no network when nothing was saved', async () => {
      await useNetworksStore.persist.rehydrate();

      expect(getActiveNetworkId()).toBe(NO_NETWORK);
    });
  });
});
