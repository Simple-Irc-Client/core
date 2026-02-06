import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  useChannelsStore,
  setAddChannel,
  setRemoveChannel,
  getChannel,
  existChannel,
  setTopic,
  getTopic,
  setTopicSetBy,
  getTopicSetBy,
  getTopicTime,
  getMessages,
  getCategory,
  setTyping,
  getTyping,
  existTyping,
  clearTyping,
  setClearUnreadMessages,
  setIncreaseUnreadMessages,
  isPriv,
  isChannel,
} from '@features/channels/store/channels';
import { ChannelCategory, MessageCategory } from '@shared/types';
import type { Message } from '@shared/types';

vi.mock('@features/settings/store/settings', () => ({
  getCurrentChannelName: vi.fn(() => '#test'),
  getChannelTypes: vi.fn(() => ['#', '&']),
}));

vi.mock('@features/chat/store/current', () => ({
  useCurrentStore: {
    getState: () => ({
      setUpdateTopic: vi.fn(),
      setUpdateMessages: vi.fn(),
      setUpdateTyping: vi.fn(),
    }),
  },
}));

const createMessage = (id: string, message: string, target: string): Message => ({
  id,
  message,
  target,
  time: new Date().toISOString(),
  category: MessageCategory.default,
});

describe('channels store', () => {
  beforeEach(() => {
    useChannelsStore.setState({
      openChannels: [],
      openChannelsShortList: [],
    });
    vi.clearAllMocks();
  });

  describe('setAddChannel', () => {
    it('should add a new channel', () => {
      setAddChannel('#test', ChannelCategory.channel);

      expect(existChannel('#test')).toBe(true);
      expect(useChannelsStore.getState().openChannels.length).toBe(1);
    });

    it('should not add duplicate channel', () => {
      setAddChannel('#test', ChannelCategory.channel);
      setAddChannel('#test', ChannelCategory.channel);

      expect(useChannelsStore.getState().openChannels.length).toBe(1);
    });

    it('should add channel with correct category', () => {
      setAddChannel('#test', ChannelCategory.channel);
      expect(getCategory('#test')).toBe(ChannelCategory.channel);

      setAddChannel('user', ChannelCategory.priv);
      expect(getCategory('user')).toBe(ChannelCategory.priv);

      setAddChannel('Status', ChannelCategory.status);
      expect(getCategory('Status')).toBe(ChannelCategory.status);
    });

    it('should initialize channel with empty values', () => {
      setAddChannel('#test', ChannelCategory.channel);

      const channel = getChannel('#test');
      expect(channel?.topic).toBe('');
      expect(channel?.messages).toEqual([]);
      expect(channel?.typing).toEqual([]);
      expect(channel?.unReadMessages).toBe(0);
    });

    it('should add to both openChannels and openChannelsShortList', () => {
      setAddChannel('#test', ChannelCategory.channel);

      expect(useChannelsStore.getState().openChannels.length).toBe(1);
      expect(useChannelsStore.getState().openChannelsShortList.length).toBe(1);
    });
  });

  describe('setRemoveChannel', () => {
    it('should remove channel', () => {
      setAddChannel('#test', ChannelCategory.channel);
      setRemoveChannel('#test');

      expect(existChannel('#test')).toBe(false);
    });

    it('should not affect other channels', () => {
      setAddChannel('#test1', ChannelCategory.channel);
      setAddChannel('#test2', ChannelCategory.channel);

      setRemoveChannel('#test1');

      expect(existChannel('#test1')).toBe(false);
      expect(existChannel('#test2')).toBe(true);
    });

    it('should remove from both lists', () => {
      setAddChannel('#test', ChannelCategory.channel);
      setRemoveChannel('#test');

      expect(useChannelsStore.getState().openChannels.length).toBe(0);
      expect(useChannelsStore.getState().openChannelsShortList.length).toBe(0);
    });
  });

  describe('getChannel', () => {
    it('should return channel by name', () => {
      setAddChannel('#test', ChannelCategory.channel);

      const channel = getChannel('#test');
      expect(channel).toBeDefined();
      expect(channel?.name).toBe('#test');
    });

    it('should return undefined for non-existent channel', () => {
      const channel = getChannel('#nonexistent');
      expect(channel).toBeUndefined();
    });
  });

  describe('existChannel', () => {
    it('should return true for existing channel', () => {
      setAddChannel('#test', ChannelCategory.channel);
      expect(existChannel('#test')).toBe(true);
    });

    it('should return false for non-existent channel', () => {
      expect(existChannel('#nonexistent')).toBe(false);
    });
  });

  describe('topic management', () => {
    it('should set topic', () => {
      setAddChannel('#test', ChannelCategory.channel);
      setTopic('#test', 'Welcome to #test!');

      expect(getTopic('#test')).toBe('Welcome to #test!');
    });

    it('should update topic', () => {
      setAddChannel('#test', ChannelCategory.channel);
      setTopic('#test', 'Old topic');
      setTopic('#test', 'New topic');

      expect(getTopic('#test')).toBe('New topic');
    });

    it('should return empty string for non-existent channel', () => {
      expect(getTopic('#nonexistent')).toBe('');
    });

    it('should set topic set by information', () => {
      setAddChannel('#test', ChannelCategory.channel);
      const timestamp = Math.floor(Date.now() / 1000);

      setTopicSetBy('#test', 'admin', timestamp);

      expect(getTopicSetBy('#test')).toBe('admin');
      expect(getTopicTime('#test')).toBe(timestamp);
    });

    it('should return empty string for topic set by on non-existent channel', () => {
      expect(getTopicSetBy('#nonexistent')).toBe('');
    });

    it('should return 0 for topic time on non-existent channel', () => {
      expect(getTopicTime('#nonexistent')).toBe(0);
    });
  });

  describe('messages', () => {
    it('should add message to channel', () => {
      setAddChannel('#test', ChannelCategory.channel);

      useChannelsStore.getState().setAddMessage(createMessage('1', 'Hello', '#test'));

      const messages = getMessages('#test');
      expect(messages.length).toBe(1);
      expect(messages[0]?.message).toBe('Hello');
    });

    it('should add multiple messages', () => {
      setAddChannel('#test', ChannelCategory.channel);

      useChannelsStore.getState().setAddMessage(createMessage('1', 'Hello', '#test'));
      useChannelsStore.getState().setAddMessage(createMessage('2', 'World', '#test'));

      const messages = getMessages('#test');
      expect(messages.length).toBe(2);
    });

    it('should return empty array for non-existent channel', () => {
      const messages = getMessages('#nonexistent');
      expect(messages).toEqual([]);
    });

    it('should not add message to wrong channel', () => {
      setAddChannel('#test1', ChannelCategory.channel);
      setAddChannel('#test2', ChannelCategory.channel);

      useChannelsStore.getState().setAddMessage(createMessage('1', 'Hello', '#test1'));

      expect(getMessages('#test1').length).toBe(1);
      expect(getMessages('#test2').length).toBe(0);
    });
  });

  describe('typing', () => {
    it('should set typing user as active', () => {
      setAddChannel('#test', ChannelCategory.channel);
      setTyping('#test', 'alice', 'active');

      expect(getTyping('#test')).toContain('alice');
    });

    it('should set typing user as paused', () => {
      setAddChannel('#test', ChannelCategory.channel);
      setTyping('#test', 'alice', 'paused');

      expect(getTyping('#test')).toContain('alice');
    });

    it('should remove typing user when done', () => {
      setAddChannel('#test', ChannelCategory.channel);
      setTyping('#test', 'alice', 'active');
      setTyping('#test', 'alice', 'done');

      expect(getTyping('#test')).not.toContain('alice');
    });

    it('should not duplicate typing user', () => {
      setAddChannel('#test', ChannelCategory.channel);
      setTyping('#test', 'alice', 'active');
      setTyping('#test', 'alice', 'active');

      expect(getTyping('#test').filter((n) => n === 'alice').length).toBe(1);
    });

    it('should handle multiple typing users', () => {
      setAddChannel('#test', ChannelCategory.channel);
      setTyping('#test', 'alice', 'active');
      setTyping('#test', 'bob', 'active');

      const typing = getTyping('#test');
      expect(typing).toContain('alice');
      expect(typing).toContain('bob');
    });

    it('should return empty array for non-existent channel', () => {
      expect(getTyping('#nonexistent')).toEqual([]);
    });
  });

  describe('existTyping', () => {
    it('should return true when user is typing', () => {
      setAddChannel('#test', ChannelCategory.channel);
      setTyping('#test', 'alice', 'active');

      expect(existTyping('#test', 'alice')).toBe(true);
    });

    it('should return false when user is not typing', () => {
      setAddChannel('#test', ChannelCategory.channel);

      expect(existTyping('#test', 'alice')).toBe(false);
    });
  });

  describe('clearTyping', () => {
    it('should clear typing for user', () => {
      setAddChannel('#test', ChannelCategory.channel);
      setTyping('#test', 'alice', 'active');

      clearTyping('#test', 'alice');

      expect(existTyping('#test', 'alice')).toBe(false);
    });

    it('should not affect other typing users', () => {
      setAddChannel('#test', ChannelCategory.channel);
      setTyping('#test', 'alice', 'active');
      setTyping('#test', 'bob', 'active');

      clearTyping('#test', 'alice');

      expect(existTyping('#test', 'alice')).toBe(false);
      expect(existTyping('#test', 'bob')).toBe(true);
    });

    it('should handle clearing non-typing user gracefully', () => {
      setAddChannel('#test', ChannelCategory.channel);

      // Should not throw
      clearTyping('#test', 'nonexistent');

      expect(existTyping('#test', 'nonexistent')).toBe(false);
    });
  });

  describe('unread messages', () => {
    it('should increase unread messages', () => {
      setAddChannel('#test', ChannelCategory.channel);

      setIncreaseUnreadMessages('#test');

      const channel = getChannel('#test');
      expect(channel?.unReadMessages).toBe(1);
    });

    it('should accumulate unread messages', () => {
      setAddChannel('#test', ChannelCategory.channel);

      setIncreaseUnreadMessages('#test');
      setIncreaseUnreadMessages('#test');
      setIncreaseUnreadMessages('#test');

      const channel = getChannel('#test');
      expect(channel?.unReadMessages).toBe(3);
    });

    it('should clear unread messages', () => {
      setAddChannel('#test', ChannelCategory.channel);

      setIncreaseUnreadMessages('#test');
      setIncreaseUnreadMessages('#test');
      setClearUnreadMessages('#test');

      const channel = getChannel('#test');
      expect(channel?.unReadMessages).toBe(0);
    });

    it('should update both openChannels and openChannelsShortList', () => {
      setAddChannel('#test', ChannelCategory.channel);

      setIncreaseUnreadMessages('#test');

      const shortListChannel = useChannelsStore.getState().openChannelsShortList.find((c) => c.name === '#test');
      expect(shortListChannel?.unReadMessages).toBe(1);
    });
  });

  describe('isPriv', () => {
    it('should return true for private message targets', () => {
      expect(isPriv('username')).toBe(true);
      expect(isPriv('another_user')).toBe(true);
    });

    it('should return false for channel names', () => {
      expect(isPriv('#channel')).toBe(false);
      expect(isPriv('&channel')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isPriv('')).toBe(false);
    });
  });

  describe('isChannel', () => {
    it('should return true for channel names', () => {
      expect(isChannel('#channel')).toBe(true);
      expect(isChannel('&channel')).toBe(true);
    });

    it('should return false for private message targets', () => {
      expect(isChannel('username')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isChannel('')).toBe(false);
    });
  });

  describe('immutability', () => {
    it('should not mutate openChannels when adding', () => {
      setAddChannel('#test1', ChannelCategory.channel);
      const channelsBefore = useChannelsStore.getState().openChannels;

      setAddChannel('#test2', ChannelCategory.channel);
      const channelsAfter = useChannelsStore.getState().openChannels;

      expect(channelsBefore).not.toBe(channelsAfter);
    });

    it('should not mutate channel when setting topic', () => {
      setAddChannel('#test', ChannelCategory.channel);
      const channelBefore = getChannel('#test');

      setTopic('#test', 'New topic');
      const channelAfter = getChannel('#test');

      expect(channelBefore).not.toBe(channelAfter);
    });

    it('should not mutate messages array when adding message', () => {
      setAddChannel('#test', ChannelCategory.channel);
      useChannelsStore.getState().setAddMessage(createMessage('1', 'First', '#test'));
      const messagesBefore = getChannel('#test')?.messages;

      useChannelsStore.getState().setAddMessage(createMessage('2', 'Second', '#test'));
      const messagesAfter = getChannel('#test')?.messages;

      expect(messagesBefore).not.toBe(messagesAfter);
    });

    it('should not mutate typing array when adding typing user', () => {
      setAddChannel('#test', ChannelCategory.channel);
      setTyping('#test', 'alice', 'active');
      const typingBefore = getChannel('#test')?.typing;

      setTyping('#test', 'bob', 'active');
      const typingAfter = getChannel('#test')?.typing;

      expect(typingBefore).not.toBe(typingAfter);
    });
  });

  describe('category', () => {
    it('should return correct category for channel', () => {
      setAddChannel('#test', ChannelCategory.channel);
      expect(getCategory('#test')).toBe(ChannelCategory.channel);
    });

    it('should return correct category for private', () => {
      setAddChannel('user', ChannelCategory.priv);
      expect(getCategory('user')).toBe(ChannelCategory.priv);
    });

    it('should return correct category for status', () => {
      setAddChannel('Status', ChannelCategory.status);
      expect(getCategory('Status')).toBe(ChannelCategory.status);
    });

    it('should return correct category for debug', () => {
      setAddChannel('Debug', ChannelCategory.debug);
      expect(getCategory('Debug')).toBe(ChannelCategory.debug);
    });

    it('should return undefined for non-existent channel', () => {
      expect(getCategory('#nonexistent')).toBeUndefined();
    });
  });
});
