import { describe, expect, it, vi, beforeEach } from 'vitest';
import { get, set, del } from 'idb-keyval';
import { ChannelCategory } from '@shared/types';
import { type Server } from '@/network/irc/servers';
import { legacyChannelKeys, legacyNetworksJson, moveLegacyBouncerIdentity, rekeyLegacyNetworks, saveLegacyNetworks } from '../legacyStorage';

vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));

const SERVER: Server = { default: 0, encoding: 'utf8', network: 'Libera.Chat', servers: ['irc.libera.chat'] };
const BOUNCER_SERVER: Server = { default: 0, encoding: 'utf8', network: 'soju', servers: ['soju.example:6697'], bouncer: { account: 'alice', encryptedPassword: 'x', networkId: '7' } };

const storeLegacySettings = (state: Record<string, unknown>, version = 4): void => {
  localStorage.setItem('sic-settings', JSON.stringify({ state, version }));
};

describe('legacy storage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(get).mockResolvedValue(undefined);
    vi.mocked(set).mockResolvedValue(undefined);
    vi.mocked(del).mockResolvedValue(undefined);
  });

  describe('legacyNetworksJson', () => {
    it('describes the session older settings kept as the active network', () => {
      storeLegacySettings({ server: SERVER, nick: 'alice', wantedNick: 'al', currentChannelName: '#chat', currentChannelCategory: ChannelCategory.channel });

      expect(JSON.parse(legacyNetworksJson() ?? '')).toEqual({
        state: {
          activeNetworkId: 'Libera.Chat',
          sessions: { 'Libera.Chat': { server: SERVER, nick: 'alice', wantedNick: 'al', currentChannelName: '#chat', currentChannelCategory: ChannelCategory.channel } },
        },
        version: 1,
      });
    });

    it('starts in Status when older settings kept no window', () => {
      storeLegacySettings({ server: SERVER });

      const saved = JSON.parse(legacyNetworksJson() ?? '') as { state: { sessions: Record<string, { nick: string; currentChannelName: string }> } };
      expect(saved.state.sessions['Libera.Chat']).toMatchObject({ nick: '', currentChannelName: 'Status' });
    });

    it.each([
      ['nothing is saved', () => {}],
      ['the settings kept no server', () => storeLegacySettings({ nick: 'alice' })],
      ['the settings are migrated already', () => storeLegacySettings({ server: SERVER }, 5)],
      ['the settings are corrupt', () => localStorage.setItem('sic-settings', '{not json')],
    ])('describes nothing when %s', (_case, arrange) => {
      arrange();

      expect(legacyNetworksJson()).toBeNull();
    });
  });

  describe('saveLegacyNetworks', () => {
    it('saves the session for the networks store', () => {
      storeLegacySettings({ server: SERVER, nick: 'alice' });

      saveLegacyNetworks();

      expect(localStorage.getItem('sic-networks')).toBe(legacyNetworksJson());
    });

    it('keeps what the networks store saved itself', () => {
      storeLegacySettings({ server: SERVER, nick: 'alice' });
      localStorage.setItem('sic-networks', 'saved');

      saveLegacyNetworks();

      expect(localStorage.getItem('sic-networks')).toBe('saved');
    });
  });

  describe('rekeyLegacyNetworks', () => {
    it('gives what was kept under a bouncer\'s name to the bouncer network then in use', () => {
      storeLegacySettings({ server: BOUNCER_SERVER });

      expect(rekeyLegacyNetworks({ soju: ['bob'], OFTC: ['carol'] })).toEqual({ 'soju/bouncer:7': ['bob'], OFTC: ['carol'] });
    });

    it('finds the network in use in the networks store once the settings are migrated', () => {
      localStorage.setItem('sic-networks', JSON.stringify({ state: { activeNetworkId: 'soju/bouncer:7', sessions: { 'soju/bouncer:7': { server: BOUNCER_SERVER } } }, version: 1 }));

      expect(rekeyLegacyNetworks({ soju: ['bob'] })).toEqual({ 'soju/bouncer:7': ['bob'] });
    });

    it('keeps everything where it was without a bouncer network', () => {
      storeLegacySettings({ server: SERVER });
      const byNetwork = { 'Libera.Chat': ['bob'] };

      expect(rekeyLegacyNetworks(byNetwork)).toBe(byNetwork);
    });

    it('keeps everything where it was when nothing was kept under the bouncer\'s name', () => {
      storeLegacySettings({ server: BOUNCER_SERVER });
      const byNetwork = { OFTC: ['carol'] };

      expect(rekeyLegacyNetworks(byNetwork)).toBe(byNetwork);
    });
  });

  describe('moveLegacyBouncerIdentity', () => {
    it('moves the identity kept under a bouncer\'s name to the bouncer network then in use', async () => {
      storeLegacySettings({ server: BOUNCER_SERVER });
      vi.mocked(get).mockResolvedValue({ publicKeyB64: 'key' });

      await moveLegacyBouncerIdentity('sic-e2ee-identity');

      expect(get).toHaveBeenCalledWith('sic-e2ee-identity:soju');
      expect(set).toHaveBeenCalledWith('sic-e2ee-identity:soju/bouncer:7', { publicKeyB64: 'key' });
      expect(del).toHaveBeenCalledWith('sic-e2ee-identity:soju');
    });

    it('moves nothing without a bouncer network', async () => {
      storeLegacySettings({ server: SERVER });

      await moveLegacyBouncerIdentity('sic-e2ee-identity');

      expect(get).not.toHaveBeenCalled();
    });

    it('moves nothing when no identity was kept', async () => {
      storeLegacySettings({ server: BOUNCER_SERVER });

      await moveLegacyBouncerIdentity('sic-e2ee-identity');

      expect(set).not.toHaveBeenCalled();
      expect(del).not.toHaveBeenCalled();
    });

    it('gives up quietly when IndexedDB fails', async () => {
      storeLegacySettings({ server: BOUNCER_SERVER });
      vi.mocked(get).mockRejectedValue(new Error('private browsing'));

      await expect(moveLegacyBouncerIdentity('sic-e2ee-identity')).resolves.toBeUndefined();
    });
  });

  describe('legacyChannelKeys', () => {
    it('lists a key per server of the network, its own server first', () => {
      const server: Server = { ...SERVER, servers: ['a.libera.chat', 'b.libera.chat'], default: 1 };

      expect(legacyChannelKeys('sic-channels', server)).toEqual(['sic-channels:Libera.Chat:b.libera.chat', 'sic-channels:Libera.Chat:a.libera.chat']);
    });

    it('adds the bouncer network to the key', () => {
      expect(legacyChannelKeys('sic-channels', BOUNCER_SERVER)).toEqual(['sic-channels:soju:soju.example:6697:7']);
    });
  });
});
