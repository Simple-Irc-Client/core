import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserDisplayName, getChannelDisplayName } from '../displayName';
import * as usersStore from '@features/users/store/users';
import * as channelsStore from '@features/channels/store/channels';

describe('displayName utility functions', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  describe('getUserDisplayName', () => {
    it('should return displayName when available', () => {
      const mockUser = {
        nick: 'testUser',
        ident: 'test',
        hostname: 'example.com',
        displayName: 'Test Display Name',
        flags: [],
        channels: [],
      };

      vi.spyOn(usersStore, 'getUser').mockReturnValue(mockUser);
      
      const result = getUserDisplayName('testUser');
      expect(result).toBe('Test Display Name');
    });

    it('should return nick when displayName is not available', () => {
      const mockUser = {
        nick: 'testUser',
        ident: 'test',
        hostname: 'example.com',
        flags: [],
        channels: [],
      };

      vi.spyOn(usersStore, 'getUser').mockReturnValue(mockUser);
      
      const result = getUserDisplayName('testUser');
      expect(result).toBe('testUser');
    });

    it('should return nick when user is not found', () => {
      vi.spyOn(usersStore, 'getUser').mockReturnValue(undefined);
      
      const result = getUserDisplayName('nonExistentUser');
      expect(result).toBe('nonExistentUser');
    });
  });

  describe('getChannelDisplayName', () => {
    it('should return displayName when available', () => {
      const mockChannel = {
        name: '#testChannel',
        category: 'channel' as const,
        unReadMessages: 0,
        displayName: 'Test Display Channel',
        messages: [],
        topic: '',
        topicSetBy: '',
        topicSetTime: 0,
        typing: [],
      };

      vi.spyOn(channelsStore, 'getChannel').mockReturnValue(mockChannel);
      
      const result = getChannelDisplayName('#testChannel');
      expect(result).toBe('Test Display Channel');
    });

    it('should return channel name when displayName is not available', () => {
      const mockChannel = {
        name: '#testChannel',
        category: 'channel' as const,
        unReadMessages: 0,
        messages: [],
        topic: '',
        topicSetBy: '',
        topicSetTime: 0,
        typing: [],
      };

      vi.spyOn(channelsStore, 'getChannel').mockReturnValue(mockChannel);
      
      const result = getChannelDisplayName('#testChannel');
      expect(result).toBe('#testChannel');
    });

    it('should return channel name when channel is not found', () => {
      vi.spyOn(channelsStore, 'getChannel').mockReturnValue(undefined);
      
      const result = getChannelDisplayName('#nonExistentChannel');
      expect(result).toBe('#nonExistentChannel');
    });
  });
});