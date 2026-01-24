import { describe, it, expect, beforeEach } from 'vitest';
import {
  addMonitoredNick,
  removeMonitoredNick,
  setMonitorOnline,
  setMonitorOffline,
  setMultipleMonitorOnline,
  setMultipleMonitorOffline,
  getMonitoredUsers,
  getOnlineMonitoredUsers,
  getOfflineMonitoredUsers,
  isNickMonitored,
  isNickOnline,
  clearMonitorList,
} from '../monitor';

describe('monitor store', () => {
  beforeEach(() => {
    clearMonitorList();
  });

  describe('addMonitoredNick', () => {
    it('should add nick to monitor list', () => {
      addMonitoredNick('TestUser');

      expect(isNickMonitored('TestUser')).toBe(true);
      expect(isNickMonitored('testuser')).toBe(true); // case insensitive
    });

    it('should not duplicate nicks', () => {
      addMonitoredNick('TestUser');
      addMonitoredNick('testuser'); // same nick, different case

      const users = getMonitoredUsers();
      expect(users).toHaveLength(1);
    });

    it('should initialize nick as offline', () => {
      addMonitoredNick('TestUser');

      expect(isNickOnline('TestUser')).toBe(false);
    });
  });

  describe('removeMonitoredNick', () => {
    it('should remove nick from monitor list', () => {
      addMonitoredNick('TestUser');
      removeMonitoredNick('TestUser');

      expect(isNickMonitored('TestUser')).toBe(false);
    });

    it('should be case insensitive', () => {
      addMonitoredNick('TestUser');
      removeMonitoredNick('TESTUSER');

      expect(isNickMonitored('TestUser')).toBe(false);
    });

    it('should handle removing non-existent nick', () => {
      removeMonitoredNick('NonExistent');
      // Should not throw
      expect(isNickMonitored('NonExistent')).toBe(false);
    });
  });

  describe('setMonitorOnline', () => {
    it('should set nick as online', () => {
      addMonitoredNick('TestUser');
      setMonitorOnline('TestUser', 'TestUser!user@host.example.com');

      expect(isNickOnline('TestUser')).toBe(true);
    });

    it('should store user string', () => {
      addMonitoredNick('TestUser');
      setMonitorOnline('TestUser', 'TestUser!user@host.example.com');

      const users = getMonitoredUsers();
      expect(users[0]?.userString).toBe('TestUser!user@host.example.com');
    });

    it('should add nick if not already monitored', () => {
      setMonitorOnline('NewUser', 'NewUser!user@host');

      expect(isNickMonitored('NewUser')).toBe(true);
      expect(isNickOnline('NewUser')).toBe(true);
    });
  });

  describe('setMonitorOffline', () => {
    it('should set nick as offline', () => {
      addMonitoredNick('TestUser');
      setMonitorOnline('TestUser');
      setMonitorOffline('TestUser');

      expect(isNickOnline('TestUser')).toBe(false);
    });

    it('should clear user string when going offline', () => {
      addMonitoredNick('TestUser');
      setMonitorOnline('TestUser', 'TestUser!user@host');
      setMonitorOffline('TestUser');

      const users = getMonitoredUsers();
      expect(users[0]?.userString).toBeUndefined();
    });
  });

  describe('setMultipleMonitorOnline', () => {
    it('should set multiple nicks online', () => {
      addMonitoredNick('User1');
      addMonitoredNick('User2');
      addMonitoredNick('User3');

      setMultipleMonitorOnline(['User1', 'User2'], ['User1!u@h', 'User2!u@h']);

      expect(isNickOnline('User1')).toBe(true);
      expect(isNickOnline('User2')).toBe(true);
      expect(isNickOnline('User3')).toBe(false);
    });

    it('should add nicks that are not already monitored', () => {
      setMultipleMonitorOnline(['NewUser1', 'NewUser2']);

      expect(isNickMonitored('NewUser1')).toBe(true);
      expect(isNickMonitored('NewUser2')).toBe(true);
    });
  });

  describe('setMultipleMonitorOffline', () => {
    it('should set multiple nicks offline', () => {
      addMonitoredNick('User1');
      addMonitoredNick('User2');
      setMonitorOnline('User1');
      setMonitorOnline('User2');

      setMultipleMonitorOffline(['User1', 'User2']);

      expect(isNickOnline('User1')).toBe(false);
      expect(isNickOnline('User2')).toBe(false);
    });

    it('should only affect existing monitored nicks', () => {
      addMonitoredNick('User1');
      setMonitorOnline('User1');

      setMultipleMonitorOffline(['User1', 'NonExistent']);

      expect(isNickOnline('User1')).toBe(false);
      expect(isNickMonitored('NonExistent')).toBe(false);
    });
  });

  describe('getMonitoredUsers', () => {
    it('should return all monitored users', () => {
      addMonitoredNick('User1');
      addMonitoredNick('User2');
      addMonitoredNick('User3');

      const users = getMonitoredUsers();
      expect(users).toHaveLength(3);
    });

    it('should return empty array when no users', () => {
      const users = getMonitoredUsers();
      expect(users).toEqual([]);
    });
  });

  describe('getOnlineMonitoredUsers', () => {
    it('should return only online users', () => {
      addMonitoredNick('User1');
      addMonitoredNick('User2');
      addMonitoredNick('User3');
      setMonitorOnline('User1');
      setMonitorOnline('User3');

      const online = getOnlineMonitoredUsers();
      expect(online).toHaveLength(2);
      expect(online.map((u) => u.nick)).toContain('User1');
      expect(online.map((u) => u.nick)).toContain('User3');
    });
  });

  describe('getOfflineMonitoredUsers', () => {
    it('should return only offline users', () => {
      addMonitoredNick('User1');
      addMonitoredNick('User2');
      addMonitoredNick('User3');
      setMonitorOnline('User1');

      const offline = getOfflineMonitoredUsers();
      expect(offline).toHaveLength(2);
      expect(offline.map((u) => u.nick)).toContain('User2');
      expect(offline.map((u) => u.nick)).toContain('User3');
    });
  });

  describe('isNickMonitored', () => {
    it('should return true for monitored nick', () => {
      addMonitoredNick('TestUser');
      expect(isNickMonitored('TestUser')).toBe(true);
    });

    it('should return false for non-monitored nick', () => {
      expect(isNickMonitored('Unknown')).toBe(false);
    });

    it('should be case insensitive', () => {
      addMonitoredNick('TestUser');
      expect(isNickMonitored('TESTUSER')).toBe(true);
      expect(isNickMonitored('testuser')).toBe(true);
    });
  });

  describe('isNickOnline', () => {
    it('should return true for online nick', () => {
      addMonitoredNick('TestUser');
      setMonitorOnline('TestUser');

      expect(isNickOnline('TestUser')).toBe(true);
    });

    it('should return false for offline nick', () => {
      addMonitoredNick('TestUser');

      expect(isNickOnline('TestUser')).toBe(false);
    });

    it('should return false for non-monitored nick', () => {
      expect(isNickOnline('Unknown')).toBe(false);
    });
  });

  describe('clearMonitorList', () => {
    it('should clear all monitored users', () => {
      addMonitoredNick('User1');
      addMonitoredNick('User2');
      addMonitoredNick('User3');

      clearMonitorList();

      expect(getMonitoredUsers()).toEqual([]);
    });
  });

  describe('store direct access', () => {
    it('should track lastUpdate timestamp', () => {
      const before = Date.now();
      addMonitoredNick('TestUser');
      const after = Date.now();

      const users = getMonitoredUsers();
      expect(users[0]?.lastUpdate).toBeGreaterThanOrEqual(before);
      expect(users[0]?.lastUpdate).toBeLessThanOrEqual(after);
    });

    it('should update lastUpdate on status change', async () => {
      addMonitoredNick('TestUser');
      const initialUsers = getMonitoredUsers();
      const initialTime = initialUsers[0]?.lastUpdate ?? 0;

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      setMonitorOnline('TestUser');
      const updatedUsers = getMonitoredUsers();

      expect(updatedUsers[0]?.lastUpdate).toBeGreaterThan(initialTime);
    });
  });
});
