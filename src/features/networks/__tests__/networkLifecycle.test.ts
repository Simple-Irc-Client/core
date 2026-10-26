import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ChannelCategory, MessageCategory } from '@shared/types';
import { ircDisconnect } from '@/network/irc/network';
import { forgetChannelsToAutoJoin, getChannelsToAutoJoin, getChannel, setAddChannel, useChannelsStore } from '@features/channels/store/channels';
import { addMonitoredNick, getMonitoredUsers, useMonitorStore } from '@features/monitor/store/monitor';
import { getReplyTo, setReplyTo } from '@features/replies/store/replyTo';
import { getIsWizardCompleted, getWizardNick, setEncryptedPassword, getEncryptedPassword, setWizardCompleted, setWizardNick, useSettingsStore } from '@features/settings/store/settings';
import { activateNetwork, getActiveNetworkId, getActiveSession, getCurrentNick, getServer, NO_NETWORK, setIsConnected, setNetworkName } from '../store/networks';
import { changeServer, resetAndGoToStart, switchToBouncerNetwork } from '../networkLifecycle';
import { clearTestSlices, connectTestNetwork, resetNetworks, TEST_SERVER } from '@/test/networks';

vi.mock('@/network/irc/network', () => ({
  ircDisconnect: vi.fn(),
}));

vi.mock('@/network/irc/readMarkers', () => ({
  markRead: vi.fn(),
}));

const BOUNCER_SERVER = { ...TEST_SERVER, network: 'soju', bouncer: { account: 'alice', encryptedPassword: 'x' } };

describe('network lifecycle', () => {
  beforeEach(() => {
    resetNetworks();
    clearTestSlices(useChannelsStore);
    clearTestSlices(useMonitorStore);
    forgetChannelsToAutoJoin();
    useSettingsStore.setState({ isWizardCompleted: true, wizardStep: 'channels', wizardNick: 'alice', serverPasswords: {} });
    connectTestNetwork(TEST_SERVER, 'alice');
    setIsConnected(true);
    vi.clearAllMocks();
  });

  describe('resetAndGoToStart', () => {
    it('disconnects and goes back to the wizard on the same network', () => {
      resetAndGoToStart();

      expect(ircDisconnect).toHaveBeenCalled();
      expect(getIsWizardCompleted()).toBe(false);
      expect(useSettingsStore.getState().wizardStep).toBe('nick');
      expect(getActiveNetworkId()).toBe('TestNet');
      expect(getActiveSession().isConnected).toBe(false);
    });

    it('closes the windows, keeping the channels to join again', () => {
      setAddChannel('#chat', ChannelCategory.channel);

      resetAndGoToStart();

      expect(getChannel('#chat')).toBeUndefined();
      expect(getChannelsToAutoJoin()).toEqual(['#chat']);
    });

    it('keeps the nick typed in the wizard, unless asked to forget it', () => {
      resetAndGoToStart();
      expect(getWizardNick()).toBe('alice');

      resetAndGoToStart(true);
      expect(getWizardNick()).toBe('');
    });
  });

  describe('changeServer', () => {
    it('leaves no network active and restarts the wizard without a nick', () => {
      setWizardNick('alice');
      setWizardCompleted(true);

      changeServer();

      expect(getActiveNetworkId()).toBe(NO_NETWORK);
      expect(getServer()).toBeUndefined();
      expect(getIsWizardCompleted()).toBe(false);
      expect(getWizardNick()).toBe('');
    });

    it('keeps the windows of the network left, for when it is chosen again', () => {
      setAddChannel('#chat', ChannelCategory.channel);

      changeServer();
      activateNetwork(TEST_SERVER, 'alice');

      expect(getChannel('#chat')).toBeDefined();
    });

    it('forgets what the connection learned: its session, friends\' statuses and replies', () => {
      setNetworkName('Test Network');
      addMonitoredNick('bob');
      setReplyTo('#chan', { id: 'm1', message: 'hi', target: '#chan', time: '2026-10-23T10:00:00.000Z', category: MessageCategory.default });

      changeServer();
      activateNetwork(TEST_SERVER, 'alice');

      expect(getActiveSession().networkName).toBeUndefined();
      expect(getMonitoredUsers()).toEqual([]);
      expect(getReplyTo('#chan')).toBeUndefined();
    });

    it('keeps the password saved for the network left', () => {
      setEncryptedPassword('secret', 'alice');

      changeServer();
      activateNetwork(TEST_SERVER, 'alice');

      expect(getEncryptedPassword()).toBe('secret');
    });
  });

  describe('switchToBouncerNetwork', () => {
    beforeEach(() => {
      activateNetwork(BOUNCER_SERVER, 'alice');
      setIsConnected(true);
    });

    it('makes the bouncer network the active one, as the same nick', () => {
      switchToBouncerNetwork({ ...BOUNCER_SERVER, bouncer: { ...BOUNCER_SERVER.bouncer, networkId: '7' } });

      expect(getActiveNetworkId()).toBe('soju/bouncer:7');
      expect(getCurrentNick()).toBe('alice');
    });

    it('keeps the windows of each network apart', () => {
      setAddChannel('#control', ChannelCategory.channel);

      switchToBouncerNetwork({ ...BOUNCER_SERVER, bouncer: { ...BOUNCER_SERVER.bouncer, networkId: '7' } });

      expect(getChannel('#control')).toBeUndefined();
      expect(getChannelsToAutoJoin()).toEqual([]);
    });

    it('keeps the wizard where it is', () => {
      useSettingsStore.setState({ isWizardCompleted: false, wizardStep: 'loading' });

      switchToBouncerNetwork({ ...BOUNCER_SERVER, bouncer: { ...BOUNCER_SERVER.bouncer, networkId: '7' } });

      expect(useSettingsStore.getState().wizardStep).toBe('loading');
    });
  });
});
