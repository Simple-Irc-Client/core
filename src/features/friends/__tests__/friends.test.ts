/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as settingsFile from '@features/settings/store/settings';
import * as networkFile from '@/network/irc/network';
import { clearMonitorList, isNickMonitored } from '@features/monitor/store/monitor';
import { useFriendsStore } from '../store/friends';
import { addFriend, getFriends, isFriend, removeFriend, resetFriendsSubscription, subscribeFriendsOnRegistration } from '../friends';
import { type Server } from '@/network/irc/servers';

const testServer = { network: 'pirc.pl' } as Server;

describe('friends actions', () => {
  type NicksMock = ReturnType<typeof vi.fn<(nicks: string[]) => void>>;
  let mockMonitorAdd: NicksMock;
  let mockMonitorRemove: NicksMock;
  let mockWatchAdd: NicksMock;
  let mockWatchRemove: NicksMock;

  beforeEach(() => {
    useFriendsStore.setState({ friendsByNetwork: {} });
    clearMonitorList();
    resetFriendsSubscription();
    vi.spyOn(settingsFile, 'getServer').mockImplementation(() => testServer);
    vi.spyOn(settingsFile, 'getIsConnected').mockImplementation(() => true);
    vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 128);
    vi.spyOn(settingsFile, 'getWatchLimit').mockImplementation(() => 0);
    mockMonitorAdd = vi.fn<(nicks: string[]) => void>();
    mockMonitorRemove = vi.fn<(nicks: string[]) => void>();
    mockWatchAdd = vi.fn<(nicks: string[]) => void>();
    mockWatchRemove = vi.fn<(nicks: string[]) => void>();
    vi.spyOn(networkFile, 'ircMonitorAdd').mockImplementation(mockMonitorAdd);
    vi.spyOn(networkFile, 'ircMonitorRemove').mockImplementation(mockMonitorRemove);
    vi.spyOn(networkFile, 'ircWatchAdd').mockImplementation(mockWatchAdd);
    vi.spyOn(networkFile, 'ircWatchRemove').mockImplementation(mockWatchRemove);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('addFriend', () => {
    it('persists, seeds monitor store and subscribes via MONITOR when connected', () => {
      expect(addFriend('Alice')).toBe(true);

      expect(getFriends()).toEqual(['Alice']);
      expect(isFriend('alice')).toBe(true);
      expect(isNickMonitored('Alice')).toBe(true);
      expect(mockMonitorAdd).toHaveBeenCalledWith(['Alice']);
      expect(mockWatchAdd).not.toHaveBeenCalled();
    });

    it('falls back to WATCH when the server has no MONITOR', () => {
      vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 0);
      vi.spyOn(settingsFile, 'getWatchLimit').mockImplementation(() => 128);

      addFriend('Alice');

      expect(mockWatchAdd).toHaveBeenCalledWith(['Alice']);
      expect(mockMonitorAdd).not.toHaveBeenCalled();
    });

    it('subscribes nothing when the server supports neither MONITOR nor WATCH', () => {
      vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 0);
      vi.spyOn(settingsFile, 'getWatchLimit').mockImplementation(() => 0);

      expect(addFriend('Alice')).toBe(true);

      expect(getFriends()).toEqual(['Alice']);
      expect(mockMonitorAdd).not.toHaveBeenCalled();
      expect(mockWatchAdd).not.toHaveBeenCalled();
    });

    it('persists without subscribing when disconnected', () => {
      vi.spyOn(settingsFile, 'getIsConnected').mockImplementation(() => false);

      expect(addFriend('Alice')).toBe(true);

      expect(getFriends()).toEqual(['Alice']);
      expect(mockMonitorAdd).not.toHaveBeenCalled();
    });

    it('rejects invalid nicks (protocol injection is impossible)', () => {
      expect(addFriend('bad nick')).toBe(false);
      expect(addFriend('a,b')).toBe(false);
      expect(addFriend('a\r\nQUIT')).toBe(false);
      expect(addFriend('')).toBe(false);

      expect(getFriends()).toEqual([]);
      expect(mockMonitorAdd).not.toHaveBeenCalled();
    });

    it('rejects when no network is configured', () => {
      vi.spyOn(settingsFile, 'getServer').mockImplementation(() => undefined);

      expect(addFriend('Alice')).toBe(false);
      expect(mockMonitorAdd).not.toHaveBeenCalled();
    });

    it('trims surrounding whitespace', () => {
      expect(addFriend('  Alice  ')).toBe(true);

      expect(getFriends()).toEqual(['Alice']);
      expect(mockMonitorAdd).toHaveBeenCalledWith(['Alice']);
    });
  });

  describe('removeFriend', () => {
    it('unpersists, unseeds monitor store and unsubscribes', () => {
      addFriend('Alice');
      removeFriend('Alice');

      expect(getFriends()).toEqual([]);
      expect(isNickMonitored('Alice')).toBe(false);
      expect(mockMonitorRemove).toHaveBeenCalledWith(['Alice']);
    });

    it('unsubscribes via WATCH on WATCH-only servers', () => {
      vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 0);
      vi.spyOn(settingsFile, 'getWatchLimit').mockImplementation(() => 128);

      addFriend('Alice');
      removeFriend('Alice');

      expect(mockWatchRemove).toHaveBeenCalledWith(['Alice']);
      expect(mockMonitorRemove).not.toHaveBeenCalled();
    });

    it('does not send when disconnected', () => {
      addFriend('Alice');
      vi.spyOn(settingsFile, 'getIsConnected').mockImplementation(() => false);
      mockMonitorRemove.mockClear();

      removeFriend('Alice');

      expect(getFriends()).toEqual([]);
      expect(mockMonitorRemove).not.toHaveBeenCalled();
    });
  });

  describe('subscribeFriendsOnRegistration', () => {
    it('subscribes all persisted friends and seeds the monitor store', () => {
      useFriendsStore.getState().addFriend('pirc.pl', 'Alice');
      useFriendsStore.getState().addFriend('pirc.pl', 'Bob');

      subscribeFriendsOnRegistration();

      expect(mockMonitorAdd).toHaveBeenCalledWith(['Alice', 'Bob']);
      expect(isNickMonitored('Alice')).toBe(true);
      expect(isNickMonitored('Bob')).toBe(true);
    });

    it('uses WATCH on servers without MONITOR', () => {
      vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 0);
      vi.spyOn(settingsFile, 'getWatchLimit').mockImplementation(() => 128);
      useFriendsStore.getState().addFriend('pirc.pl', 'Alice');
      useFriendsStore.getState().addFriend('pirc.pl', 'Bob');

      subscribeFriendsOnRegistration();

      expect(mockWatchAdd).toHaveBeenCalledWith(['Alice', 'Bob']);
    });

    it('runs only once per connection until reset', () => {
      useFriendsStore.getState().addFriend('pirc.pl', 'Alice');

      subscribeFriendsOnRegistration();
      subscribeFriendsOnRegistration(); // e.g. a manual /motd replaying 376

      expect(mockMonitorAdd).toHaveBeenCalledTimes(1);

      resetFriendsSubscription(); // next connection's 001
      subscribeFriendsOnRegistration();

      expect(mockMonitorAdd).toHaveBeenCalledTimes(2);
    });

    it('sends nothing when there are no friends', () => {
      subscribeFriendsOnRegistration();

      expect(mockMonitorAdd).not.toHaveBeenCalled();
      expect(mockWatchAdd).not.toHaveBeenCalled();
    });

    it('splits long lists into chunks that each fit an IRC line', () => {
      const nicks = Array.from({ length: 60 }, (_, i) => `VeryLongFriendNickname${String(i).padStart(3, '0')}`);
      for (const nick of nicks) {
        useFriendsStore.getState().addFriend('pirc.pl', nick);
      }

      subscribeFriendsOnRegistration();

      const chunks = mockMonitorAdd.mock.calls.map((call) => call[0] as string[]);
      expect(chunks.length).toBeGreaterThan(1);
      for (const chunk of chunks) {
        expect(`MONITOR + ${chunk.join(',')}`.length).toBeLessThanOrEqual(510);
      }
      // Every nick is subscribed exactly once across the chunks
      expect(chunks.flat()).toEqual(nicks);
    });
  });
});
