/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as settingsFile from '@features/settings/store/settings';
import * as networkFile from '@/network/irc/network';
import { clearMonitorList, isNickMonitored } from '@features/monitor/store/monitor';
import { useChannelsStore, setAddChannel, setRemoveChannel, getOpenDmNicks, existChannel } from '@features/channels/store/channels';
import { useFriendsStore } from '@features/friends/store/friends';
import { addFriend, isFriend, removeFriend } from '@features/friends/friends';
import { ChannelCategory } from '@shared/types';
import {
  handlePresenceNickChange,
  resetDmPresenceSubscription,
  subscribeDmPresence,
  subscribeDmPresenceOnRegistration,
  unsubscribeDmPresence,
} from '../dmPresence';
import { type Server } from '@/network/irc/servers';

const testServer = { network: 'pirc.pl' } as Server;

describe('dmPresence actions', () => {
  type NicksMock = ReturnType<typeof vi.fn<(nicks: string[]) => void>>;
  let mockMonitorAdd: NicksMock;
  let mockMonitorRemove: NicksMock;
  let mockWatchAdd: NicksMock;
  let mockWatchRemove: NicksMock;

  beforeEach(() => {
    useChannelsStore.setState({ openChannels: [], openChannelsShortList: [] });
    useFriendsStore.setState({ friendsByNetwork: {} });
    clearMonitorList();
    resetDmPresenceSubscription();
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

  describe('subscribeDmPresence', () => {
    it('seeds the monitor store and subscribes via MONITOR when connected', () => {
      subscribeDmPresence('Alice');

      expect(isNickMonitored('Alice')).toBe(true);
      expect(mockMonitorAdd).toHaveBeenCalledWith(['Alice']);
    });

    it('does nothing when disconnected', () => {
      vi.spyOn(settingsFile, 'getIsConnected').mockImplementation(() => false);

      subscribeDmPresence('Alice');

      expect(isNickMonitored('Alice')).toBe(false);
      expect(mockMonitorAdd).not.toHaveBeenCalled();
    });

    it('falls back to WATCH when the server has no MONITOR', () => {
      vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 0);
      vi.spyOn(settingsFile, 'getWatchLimit').mockImplementation(() => 128);

      subscribeDmPresence('Alice');

      expect(mockWatchAdd).toHaveBeenCalledWith(['Alice']);
      expect(mockMonitorAdd).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribeDmPresence', () => {
    it('unseeds the monitor store and unsubscribes when connected', () => {
      subscribeDmPresence('Alice');

      unsubscribeDmPresence('Alice');

      expect(isNickMonitored('Alice')).toBe(false);
      expect(mockMonitorRemove).toHaveBeenCalledWith(['Alice']);
    });

    it('does not send when disconnected', () => {
      subscribeDmPresence('Alice');
      vi.spyOn(settingsFile, 'getIsConnected').mockImplementation(() => false);
      mockMonitorRemove.mockClear();

      unsubscribeDmPresence('Alice');

      expect(isNickMonitored('Alice')).toBe(false);
      expect(mockMonitorRemove).not.toHaveBeenCalled();
    });

    it('keeps monitoring a nick that is still a friend', () => {
      addFriend('Alice');
      mockMonitorAdd.mockClear();

      unsubscribeDmPresence('Alice');

      expect(isNickMonitored('Alice')).toBe(true);
      expect(mockMonitorRemove).not.toHaveBeenCalled();
    });
  });

  describe('subscribeDmPresenceOnRegistration', () => {
    it('subscribes every currently open DM window', () => {
      setAddChannel('Alice', ChannelCategory.priv);
      setAddChannel('Bob', ChannelCategory.priv);
      setAddChannel('#general', ChannelCategory.channel);

      subscribeDmPresenceOnRegistration();

      expect(mockMonitorAdd).toHaveBeenCalledWith(['Alice', 'Bob']);
      expect(isNickMonitored('Alice')).toBe(true);
      expect(isNickMonitored('Bob')).toBe(true);
      expect(isNickMonitored('#general')).toBe(false);
    });

    it('runs only once per connection until reset', () => {
      setAddChannel('Alice', ChannelCategory.priv);

      subscribeDmPresenceOnRegistration();
      subscribeDmPresenceOnRegistration(); // e.g. a manual /motd replaying 376

      expect(mockMonitorAdd).toHaveBeenCalledTimes(1);

      resetDmPresenceSubscription(); // next connection's 001
      subscribeDmPresenceOnRegistration();

      expect(mockMonitorAdd).toHaveBeenCalledTimes(2);
    });

    it('sends nothing when no DM window is open', () => {
      subscribeDmPresenceOnRegistration();

      expect(mockMonitorAdd).not.toHaveBeenCalled();
      expect(mockWatchAdd).not.toHaveBeenCalled();
    });
  });

  describe('handlePresenceNickChange', () => {
    it('follows a rename for an open DM window: renames the window and moves the MONITOR subscription', () => {
      setAddChannel('Bob', ChannelCategory.priv);
      subscribeDmPresence('Bob');
      mockMonitorAdd.mockClear();

      handlePresenceNickChange('Bob', 'Bob2');

      expect(existChannel('Bob')).toBe(false);
      expect(existChannel('Bob2')).toBe(true);
      expect(getOpenDmNicks()).toEqual(['Bob2']);
      expect(isNickMonitored('Bob')).toBe(false);
      expect(isNickMonitored('Bob2')).toBe(true);
      expect(mockMonitorRemove).toHaveBeenCalledWith(['Bob']);
      expect(mockMonitorAdd).toHaveBeenCalledWith(['Bob2']);

      setRemoveChannel('Bob2');
    });

    it('follows a rename for a friend: renames the persisted entry and moves the MONITOR subscription', () => {
      addFriend('Bob');
      mockMonitorAdd.mockClear();

      handlePresenceNickChange('Bob', 'Bob2');

      expect(isFriend('Bob')).toBe(false);
      expect(isFriend('Bob2')).toBe(true);
      expect(isNickMonitored('Bob')).toBe(false);
      expect(isNickMonitored('Bob2')).toBe(true);
      expect(mockMonitorRemove).toHaveBeenCalledWith(['Bob']);
      expect(mockMonitorAdd).toHaveBeenCalledWith(['Bob2']);
    });

    it('sends exactly one unsubscribe/subscribe pair when the nick is both a friend and has an open DM window', () => {
      addFriend('Bob');
      setAddChannel('Bob', ChannelCategory.priv);
      mockMonitorAdd.mockClear();
      mockMonitorRemove.mockClear();

      handlePresenceNickChange('Bob', 'Bob2');

      expect(isFriend('Bob2')).toBe(true);
      expect(getOpenDmNicks()).toEqual(['Bob2']);
      expect(mockMonitorRemove).toHaveBeenCalledTimes(1);
      expect(mockMonitorAdd).toHaveBeenCalledTimes(1);

      setRemoveChannel('Bob2');
    });

    it('does nothing for a nick that is neither a friend nor has an open DM window', () => {
      handlePresenceNickChange('Stranger', 'Stranger2');

      expect(isNickMonitored('Stranger')).toBe(false);
      expect(isNickMonitored('Stranger2')).toBe(false);
      expect(mockMonitorAdd).not.toHaveBeenCalled();
      expect(mockMonitorRemove).not.toHaveBeenCalled();
    });

    it('still renames local data when disconnected, but sends nothing over the wire', () => {
      setAddChannel('Bob', ChannelCategory.priv);
      subscribeDmPresence('Bob');
      vi.spyOn(settingsFile, 'getIsConnected').mockImplementation(() => false);
      mockMonitorAdd.mockClear();
      mockMonitorRemove.mockClear();

      handlePresenceNickChange('Bob', 'Bob2');

      expect(getOpenDmNicks()).toEqual(['Bob2']);
      expect(isNickMonitored('Bob2')).toBe(true);
      expect(mockMonitorAdd).not.toHaveBeenCalled();
      expect(mockMonitorRemove).not.toHaveBeenCalled();

      setRemoveChannel('Bob2');
    });

    it('uses WATCH on servers without MONITOR', () => {
      vi.spyOn(settingsFile, 'getMonitorLimit').mockImplementation(() => 0);
      vi.spyOn(settingsFile, 'getWatchLimit').mockImplementation(() => 128);
      addFriend('Bob');
      mockWatchAdd.mockClear();

      handlePresenceNickChange('Bob', 'Bob2');

      expect(mockWatchRemove).toHaveBeenCalledWith(['Bob']);
      expect(mockWatchAdd).toHaveBeenCalledWith(['Bob2']);
    });
  });

  describe('interaction with friends', () => {
    it('removeFriend keeps the subscription alive while a DM window for that nick is still open', () => {
      addFriend('Alice');
      setAddChannel('Alice', ChannelCategory.priv);
      mockMonitorRemove.mockClear();

      removeFriend('Alice');

      expect(isNickMonitored('Alice')).toBe(true);
      expect(mockMonitorRemove).not.toHaveBeenCalled();

      // Closing the DM window afterwards drops it for real.
      unsubscribeDmPresence('Alice');
      expect(isNickMonitored('Alice')).toBe(false);
      expect(mockMonitorRemove).toHaveBeenCalledWith(['Alice']);
    });

    it('closing a DM window for a friend leaves friend monitoring untouched', () => {
      addFriend('Alice');
      setAddChannel('Alice', ChannelCategory.priv);
      mockMonitorRemove.mockClear();

      unsubscribeDmPresence('Alice');

      expect(isNickMonitored('Alice')).toBe(true);
      expect(mockMonitorRemove).not.toHaveBeenCalled();

      setRemoveChannel('Alice');
    });
  });
});
