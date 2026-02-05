import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getUserDisplayName, getChannelDisplayName, getNickFromMessage, getDisplayNickFromMessage } from '../displayName';
import { MessageCategory, type Message, type User } from '@shared/types';

// Mock the store functions
vi.mock('@features/users/store/users', () => ({
  getUser: vi.fn(),
}));

vi.mock('@features/channels/store/channels', () => ({
  getChannel: vi.fn(),
}));

import { getUser } from '@features/users/store/users';
import { getChannel } from '@features/channels/store/channels';

const mockedGetUser = vi.mocked(getUser);
const mockedGetChannel = vi.mocked(getChannel);

describe('displayName utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUserDisplayName', () => {
    it('should return displayName when user has one', () => {
      mockedGetUser.mockReturnValue({
        nick: 'john',
        displayName: 'John Doe',
        ident: 'user',
        hostname: 'host.com',
        flags: [],
        channels: [],
      });

      expect(getUserDisplayName('john')).toBe('John Doe');
    });

    it('should return nick when user has no displayName', () => {
      mockedGetUser.mockReturnValue({
        nick: 'john',
        ident: 'user',
        hostname: 'host.com',
        flags: [],
        channels: [],
      });

      expect(getUserDisplayName('john')).toBe('john');
    });

    it('should return nick when user is not found', () => {
      mockedGetUser.mockReturnValue(undefined);

      expect(getUserDisplayName('unknown')).toBe('unknown');
    });

    it('should return nick when displayName is empty string', () => {
      mockedGetUser.mockReturnValue({
        nick: 'john',
        displayName: '',
        ident: 'user',
        hostname: 'host.com',
        flags: [],
        channels: [],
      });

      expect(getUserDisplayName('john')).toBe('john');
    });
  });

  describe('getChannelDisplayName', () => {
    it('should return displayName when channel has one', () => {
      mockedGetChannel.mockReturnValue({
        name: '#test',
        displayName: 'Test Channel',
        category: 'channel',
        unReadMessages: 0,
        messages: [],
        topic: '',
        topicSetBy: '',
        topicSetTime: 0,
        typing: [],
      });

      expect(getChannelDisplayName('#test')).toBe('Test Channel');
    });

    it('should return channel name when channel has no displayName', () => {
      mockedGetChannel.mockReturnValue({
        name: '#test',
        category: 'channel',
        unReadMessages: 0,
        messages: [],
        topic: '',
        topicSetBy: '',
        topicSetTime: 0,
        typing: [],
      });

      expect(getChannelDisplayName('#test')).toBe('#test');
    });

    it('should return channel name when channel is not found', () => {
      mockedGetChannel.mockReturnValue(undefined);

      expect(getChannelDisplayName('#unknown')).toBe('#unknown');
    });
  });

  describe('getNickFromMessage', () => {
    it('should return undefined when message is undefined', () => {
      expect(getNickFromMessage(undefined)).toBeUndefined();
    });

    it('should return undefined when message has no nick', () => {
      const message: Message = {
        id: '1',
        message: 'test',
        target: '#test',
        time: new Date().toISOString(),
        category: MessageCategory.info,
      };

      expect(getNickFromMessage(message)).toBeUndefined();
    });

    it('should return string nick directly', () => {
      const message: Message = {
        id: '1',
        message: 'test',
        nick: 'john',
        target: '#test',
        time: new Date().toISOString(),
        category: MessageCategory.default,
      };

      expect(getNickFromMessage(message)).toBe('john');
    });

    it('should extract nick from User object', () => {
      const user: User = {
        nick: 'john',
        displayName: 'John Doe',
        ident: 'user',
        hostname: 'host.com',
        flags: [],
        channels: [],
      };

      const message: Message = {
        id: '1',
        message: 'test',
        nick: user,
        target: '#test',
        time: new Date().toISOString(),
        category: MessageCategory.default,
      };

      expect(getNickFromMessage(message)).toBe('john');
    });
  });

  describe('getDisplayNickFromMessage', () => {
    it('should return empty string when message is undefined', () => {
      expect(getDisplayNickFromMessage(undefined)).toBe('');
    });

    it('should return empty string when message has no nick', () => {
      const message: Message = {
        id: '1',
        message: 'test',
        target: '#test',
        time: new Date().toISOString(),
        category: MessageCategory.info,
      };

      expect(getDisplayNickFromMessage(message)).toBe('');
    });

    it('should use live lookup for string nick', () => {
      mockedGetUser.mockReturnValue({
        nick: 'john',
        displayName: 'John Doe',
        ident: 'user',
        hostname: 'host.com',
        flags: [],
        channels: [],
      });

      const message: Message = {
        id: '1',
        message: 'test',
        nick: 'john',
        target: '#test',
        time: new Date().toISOString(),
        category: MessageCategory.default,
      };

      expect(getDisplayNickFromMessage(message)).toBe('John Doe');
    });

    it('should use snapshot displayName from User object', () => {
      const user: User = {
        nick: 'john',
        displayName: 'Snapshot Name',
        ident: 'user',
        hostname: 'host.com',
        flags: [],
        channels: [],
      };

      const message: Message = {
        id: '1',
        message: 'test',
        nick: user,
        target: '#test',
        time: new Date().toISOString(),
        category: MessageCategory.default,
      };

      // Even if live lookup returns different name, snapshot should be used
      mockedGetUser.mockReturnValue({
        nick: 'john',
        displayName: 'Live Name',
        ident: 'user',
        hostname: 'host.com',
        flags: [],
        channels: [],
      });

      expect(getDisplayNickFromMessage(message)).toBe('Snapshot Name');
    });

    it('should fallback to nick when User object has no displayName', () => {
      const user: User = {
        nick: 'john',
        ident: 'user',
        hostname: 'host.com',
        flags: [],
        channels: [],
      };

      const message: Message = {
        id: '1',
        message: 'test',
        nick: user,
        target: '#test',
        time: new Date().toISOString(),
        category: MessageCategory.default,
      };

      expect(getDisplayNickFromMessage(message)).toBe('john');
    });

    it('should fallback to nick when User object has empty displayName', () => {
      const user: User = {
        nick: 'john',
        displayName: '',
        ident: 'user',
        hostname: 'host.com',
        flags: [],
        channels: [],
      };

      const message: Message = {
        id: '1',
        message: 'test',
        nick: user,
        target: '#test',
        time: new Date().toISOString(),
        category: MessageCategory.default,
      };

      expect(getDisplayNickFromMessage(message)).toBe('john');
    });
  });
});
