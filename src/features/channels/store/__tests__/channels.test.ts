import { describe, expect, it, vi, beforeEach } from 'vitest';
import { DEFAULT_CASE_MAPPING, namesEqual } from '@shared/lib/caseMapping';
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
  setClearMessages,
  getCategory,
  setTyping,
  getTyping,
  existTyping,
  clearTyping,
  clearAllTyping,
  setClearUnreadMessages,
  setIncreaseUnreadMessages,
  setHasMention,
  isPriv,
  isChannel,
  setAddMessage,
  setRenameChannel,
  migrateChannels,
} from '@features/channels/store/channels';
import { ChannelCategory, MessageCategory } from '@shared/types';
import type { Channel, ChannelExtended, Message } from '@shared/types';

vi.mock('idb-keyval', () => ({
  get: vi.fn(() => Promise.resolve(null)),
  set: vi.fn(() => Promise.resolve()),
  del: vi.fn(() => Promise.resolve()),
}));

vi.mock('@features/settings/store/settings', () => ({
  getCurrentChannelName: vi.fn(() => '#test'),
  getChannelTypes: vi.fn(() => ['#', '&']),
  // Real folding: the store's channel identity depends on it
  getCaseMapping: vi.fn(() => DEFAULT_CASE_MAPPING),
  isSameName: vi.fn((a: string, b: string) => namesEqual(a, b)),
  setCurrentChannelName: vi.fn(),
  syncCurrentUsers: vi.fn(),
}));

const mockSetUpdateTyping = vi.fn();

vi.mock('@features/chat/store/current', () => ({
  useCurrentStore: {
    getState: () => ({
      setUpdateTopic: vi.fn(),
      setUpdateMessages: vi.fn(),
      setUpdateTyping: mockSetUpdateTyping,
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

const createMessageAt = (id: string, message: string, target: string, time: string): Message => ({
  ...createMessage(id, message, target),
  time,
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

    it('should not add duplicate message with same id', () => {
      setAddChannel('#test', ChannelCategory.channel);

      useChannelsStore.getState().setAddMessage(createMessage('msg-1', 'Hello', '#test'));
      useChannelsStore.getState().setAddMessage(createMessage('msg-1', 'Hello', '#test'));

      expect(getMessages('#test').length).toBe(1);
    });

    it('should not add duplicate even with different message text', () => {
      setAddChannel('#test', ChannelCategory.channel);

      useChannelsStore.getState().setAddMessage(createMessage('msg-1', 'Hello', '#test'));
      useChannelsStore.getState().setAddMessage(createMessage('msg-1', 'Different text', '#test'));

      const messages = getMessages('#test');
      expect(messages.length).toBe(1);
      expect(messages[0]?.message).toBe('Hello');
    });

    it('should add messages with different ids', () => {
      setAddChannel('#test', ChannelCategory.channel);

      useChannelsStore.getState().setAddMessage(createMessage('msg-1', 'Hello', '#test'));
      useChannelsStore.getState().setAddMessage(createMessage('msg-2', 'World', '#test'));

      expect(getMessages('#test').length).toBe(2);
    });

    it('should not deduplicate across different channels', () => {
      setAddChannel('#test1', ChannelCategory.channel);
      setAddChannel('#test2', ChannelCategory.channel);

      useChannelsStore.getState().setAddMessage(createMessage('msg-1', 'Hello', '#test1'));
      useChannelsStore.getState().setAddMessage(createMessage('msg-1', 'Hello', '#test2'));

      expect(getMessages('#test1').length).toBe(1);
      expect(getMessages('#test2').length).toBe(1);
    });

    it('should clear messages for a specific channel', () => {
      setAddChannel('#test', ChannelCategory.channel);

      useChannelsStore.getState().setAddMessage(createMessage('1', 'Hello', '#test'));
      useChannelsStore.getState().setAddMessage(createMessage('2', 'World', '#test'));
      expect(getMessages('#test').length).toBe(2);

      setClearMessages('#test');

      expect(getMessages('#test').length).toBe(0);
    });

    it('should not affect other channels when clearing messages', () => {
      setAddChannel('#test1', ChannelCategory.channel);
      setAddChannel('#test2', ChannelCategory.channel);

      useChannelsStore.getState().setAddMessage(createMessage('1', 'Hello', '#test1'));
      useChannelsStore.getState().setAddMessage(createMessage('2', 'World', '#test2'));

      setClearMessages('#test1');

      expect(getMessages('#test1').length).toBe(0);
      expect(getMessages('#test2').length).toBe(1);
    });

    it('should handle clearing messages on channel with no messages', () => {
      setAddChannel('#test', ChannelCategory.channel);

      setClearMessages('#test');

      expect(getMessages('#test').length).toBe(0);
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

    it('should expire an active typing indicator after 6 seconds of silence', () => {
      vi.useFakeTimers();
      try {
        setAddChannel('#test', ChannelCategory.channel);
        setTyping('#test', 'alice', 'active');

        vi.advanceTimersByTime(5_999);
        expect(getTyping('#test')).toContain('alice');

        vi.advanceTimersByTime(1);
        expect(getTyping('#test')).not.toContain('alice');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should keep the indicator alive while typing updates keep arriving', () => {
      vi.useFakeTimers();
      try {
        setAddChannel('#test', ChannelCategory.channel);
        setTyping('#test', 'alice', 'active');

        vi.advanceTimersByTime(5_000);
        setTyping('#test', 'alice', 'active');

        vi.advanceTimersByTime(5_000);
        expect(getTyping('#test')).toContain('alice');

        vi.advanceTimersByTime(1_000);
        expect(getTyping('#test')).not.toContain('alice');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should expire a paused typing indicator after 30 seconds', () => {
      vi.useFakeTimers();
      try {
        setAddChannel('#test', ChannelCategory.channel);
        setTyping('#test', 'alice', 'paused');

        vi.advanceTimersByTime(29_999);
        expect(getTyping('#test')).toContain('alice');

        vi.advanceTimersByTime(1);
        expect(getTyping('#test')).not.toContain('alice');
      } finally {
        vi.useRealTimers();
      }
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

  describe('clearAllTyping', () => {
    it('should clear typing in all channels', () => {
      setAddChannel('#test', ChannelCategory.channel);
      setAddChannel('#other', ChannelCategory.channel);
      setTyping('#test', 'alice', 'active');
      setTyping('#other', 'bob', 'active');

      clearAllTyping();

      expect(getTyping('#test')).toEqual([]);
      expect(getTyping('#other')).toEqual([]);
    });

    it('should clear typing in current store', () => {
      setAddChannel('#test', ChannelCategory.channel);
      setTyping('#test', 'alice', 'active');
      mockSetUpdateTyping.mockClear();

      clearAllTyping();

      expect(mockSetUpdateTyping).toHaveBeenCalledWith([]);
    });

    it('should handle no channels gracefully', () => {
      clearAllTyping();

      expect(useChannelsStore.getState().openChannels).toEqual([]);
    });

    it('should not affect channels with no typing', () => {
      setAddChannel('#test', ChannelCategory.channel);
      setAddChannel('#quiet', ChannelCategory.channel);
      setTyping('#test', 'alice', 'active');

      clearAllTyping();

      expect(getTyping('#test')).toEqual([]);
      expect(getTyping('#quiet')).toEqual([]);
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

  describe('mentions', () => {
    it('should set hasMention on channel', () => {
      setAddChannel('#test', ChannelCategory.channel);

      setHasMention('#test');

      const channel = getChannel('#test');
      expect(channel?.hasMention).toBe(true);
    });

    it('should set hasMention in both lists', () => {
      setAddChannel('#test', ChannelCategory.channel);

      setHasMention('#test');

      const shortListChannel = useChannelsStore.getState().openChannelsShortList.find((c) => c.name === '#test');
      expect(shortListChannel?.hasMention).toBe(true);
    });

    it('should not affect other channels when setting hasMention', () => {
      setAddChannel('#test1', ChannelCategory.channel);
      setAddChannel('#test2', ChannelCategory.channel);

      setHasMention('#test1');

      expect(getChannel('#test1')?.hasMention).toBe(true);
      expect(getChannel('#test2')?.hasMention).toBeUndefined();
    });

    it('should clear hasMention when clearing unread messages', () => {
      setAddChannel('#test', ChannelCategory.channel);

      setHasMention('#test');
      setIncreaseUnreadMessages('#test');
      setClearUnreadMessages('#test');

      const channel = getChannel('#test');
      expect(channel?.hasMention).toBe(false);
      expect(channel?.unReadMessages).toBe(0);
    });

    it('should clear hasMention in both lists when clearing unread messages', () => {
      setAddChannel('#test', ChannelCategory.channel);

      setHasMention('#test');
      setClearUnreadMessages('#test');

      const shortListChannel = useChannelsStore.getState().openChannelsShortList.find((c) => c.name === '#test');
      expect(shortListChannel?.hasMention).toBe(false);
    });
  });

  // Reported by a user: two "#religie" entries in the channel list - one showing
  // only the system messages, the other the actual chat, and removing either one
  // left the other behind.
  describe('channel name casing', () => {
    it('should not open a second window when the server echoes a different casing', () => {
      setAddChannel('#religie', ChannelCategory.channel);

      setAddMessage(createMessage('1', 'hello', '#Religie'));

      expect(useChannelsStore.getState().openChannels.length).toBe(1);
      expect(useChannelsStore.getState().openChannelsShortList.length).toBe(1);
      expect(getMessages('#religie').length).toBe(1);
    });

    it('should find an existing channel regardless of the casing asked for', () => {
      setAddChannel('#Religie', ChannelCategory.channel);

      expect(existChannel('#religie')).toBe(true);
      expect(existChannel('#RELIGIE')).toBe(true);
      expect(getChannel('#religie')?.name).toBe('#Religie');
      expect(getCategory('#religie')).toBe(ChannelCategory.channel);
    });

    it('should not add a duplicate when setAddChannel is called with another casing', () => {
      setAddChannel('#religie', ChannelCategory.channel);
      setAddChannel('#Religie', ChannelCategory.channel);

      expect(useChannelsStore.getState().openChannels.length).toBe(1);
    });

    it('should remove the channel whatever casing the remove is asked for', () => {
      setAddChannel('#Religie', ChannelCategory.channel);

      setRemoveChannel('#religie');

      expect(existChannel('#Religie')).toBe(false);
      expect(useChannelsStore.getState().openChannels.length).toBe(0);
      expect(useChannelsStore.getState().openChannelsShortList.length).toBe(0);
    });

    it('should route topic, messages and typing to the one window', () => {
      setAddChannel('#religie', ChannelCategory.channel);

      setTopic('#Religie', 'a topic');
      setAddMessage(createMessage('1', 'chat', '#RELIGIE'));
      setTyping('#Religie', 'someone', 'active');

      expect(getTopic('#religie')).toBe('a topic');
      expect(getMessages('#religie').length).toBe(1);
      expect(getTyping('#religie')).toEqual(['someone']);
    });

    it('should treat DM windows for the same nick as one', () => {
      setAddChannel('Merovingian', ChannelCategory.priv);

      setAddMessage(createMessage('1', 'hi', 'merovingian'));

      expect(useChannelsStore.getState().openChannels.length).toBe(1);
      expect(getMessages('Merovingian').length).toBe(1);
    });

    it('should still keep genuinely different channels apart', () => {
      setAddChannel('#religie', ChannelCategory.channel);
      setAddChannel('#religia', ChannelCategory.channel);

      expect(useChannelsStore.getState().openChannels.length).toBe(2);
    });
  });

  describe('setRenameChannel', () => {
    it('should adopt the server casing in both lists', () => {
      setAddChannel('#religie', ChannelCategory.channel);

      setRenameChannel('#religie', '#Religie');

      expect(getChannel('#religie')?.name).toBe('#Religie');
      expect(useChannelsStore.getState().openChannelsShortList[0]?.name).toBe('#Religie');
    });

    it('should keep the messages and retarget them at the new name', () => {
      setAddChannel('#religie', ChannelCategory.channel);
      setAddMessage(createMessage('1', 'chat', '#religie'));

      setRenameChannel('#religie', '#Religie');

      const messages = getMessages('#Religie');
      expect(messages.length).toBe(1);
      expect(messages[0]?.target).toBe('#Religie');
    });

    it('should do nothing when the channel is not open', () => {
      setRenameChannel('#religie', '#Religie');

      expect(useChannelsStore.getState().openChannels.length).toBe(0);
    });

    it('should do nothing when the name is unchanged', () => {
      setAddChannel('#religie', ChannelCategory.channel);
      const before = useChannelsStore.getState().openChannels;

      setRenameChannel('#religie', '#religie');

      expect(useChannelsStore.getState().openChannels).toBe(before);
    });
  });

  describe('migrateChannels', () => {
    const channel = (name: string, overrides: Partial<ChannelExtended> = {}): ChannelExtended => ({
      name,
      category: ChannelCategory.channel,
      messages: [],
      topic: '',
      topicSetBy: '',
      topicSetTime: 0,
      unReadMessages: 0,
      typing: [],
      ...overrides,
    });

    const shortListChannel = (name: string, overrides: Partial<Channel> = {}): Channel => ({
      name,
      category: ChannelCategory.channel,
      unReadMessages: 0,
      ...overrides,
    });

    it('should merge case-duplicate channels into one window', () => {
      const migrated = migrateChannels({
        openChannels: [channel('#religie'), channel('#Religie')],
        openChannelsShortList: [shortListChannel('#religie'), shortListChannel('#Religie')],
      }, 1);

      expect(migrated.openChannels.length).toBe(1);
      expect(migrated.openChannelsShortList.length).toBe(1);
    });

    it('should keep the first name so a later JOIN can correct it', () => {
      const migrated = migrateChannels({
        openChannels: [channel('#religie'), channel('#Religie')],
        openChannelsShortList: [],
      }, 1);

      expect(migrated.openChannels[0]?.name).toBe('#religie');
    });

    it('should interleave the messages of both windows by time', () => {
      const migrated = migrateChannels({
        openChannels: [
          channel('#religie', { messages: [
            createMessageAt('sys-1', 'connected', '#religie', '2026-07-30T10:00:00.000Z'),
            createMessageAt('sys-2', 'connected', '#religie', '2026-07-30T12:00:00.000Z'),
          ] }),
          channel('#Religie', { messages: [
            createMessageAt('chat-1', 'hello', '#Religie', '2026-07-30T11:00:00.000Z'),
          ] }),
        ],
        openChannelsShortList: [],
      }, 1);

      expect(migrated.openChannels[0]?.messages.map((message) => message.id)).toEqual(['sys-1', 'chat-1', 'sys-2']);
    });

    it('should drop messages that both windows already hold', () => {
      const migrated = migrateChannels({
        openChannels: [
          channel('#religie', { messages: [createMessage('same', 'hello', '#religie')] }),
          channel('#Religie', { messages: [createMessage('same', 'hello', '#Religie')] }),
        ],
        openChannelsShortList: [],
      }, 1);

      expect(migrated.openChannels[0]?.messages.length).toBe(1);
    });

    it('should cap the merged history at maxMessages', () => {
      const many = (prefix: string, count: number): Message[] =>
        Array.from({ length: count }, (_, index) => createMessageAt(`${prefix}-${index}`, 'm', '#religie', `2026-07-30T10:00:${String(index % 60).padStart(2, '0')}.000Z`));

      const migrated = migrateChannels({
        openChannels: [
          channel('#religie', { messages: many('a', 250) }),
          channel('#Religie', { messages: many('b', 250) }),
        ],
        openChannelsShortList: [],
      }, 1);

      expect(migrated.openChannels[0]?.messages.length).toBe(300);
    });

    it('should carry over the topic from the window that has one', () => {
      const migrated = migrateChannels({
        openChannels: [
          channel('#religie'),
          channel('#Religie', { topic: 'the topic', topicSetBy: 'op', topicSetTime: 42 }),
        ],
        openChannelsShortList: [],
      }, 1);

      expect(migrated.openChannels[0]?.topic).toBe('the topic');
      expect(migrated.openChannels[0]?.topicSetBy).toBe('op');
      expect(migrated.openChannels[0]?.topicSetTime).toBe(42);
    });

    it('should keep the topic of the first window when both have one', () => {
      const migrated = migrateChannels({
        openChannels: [
          channel('#religie', { topic: 'first' }),
          channel('#Religie', { topic: 'second' }),
        ],
        openChannelsShortList: [],
      }, 1);

      expect(migrated.openChannels[0]?.topic).toBe('first');
    });

    it('should add up the unread counts and keep a mention from either window', () => {
      const migrated = migrateChannels({
        openChannels: [
          channel('#religie', { unReadMessages: 2 }),
          channel('#Religie', { unReadMessages: 3, hasMention: true }),
        ],
        openChannelsShortList: [
          shortListChannel('#religie', { unReadMessages: 2 }),
          shortListChannel('#Religie', { unReadMessages: 3, hasMention: true }),
        ],
      }, 1);

      expect(migrated.openChannels[0]?.unReadMessages).toBe(5);
      expect(migrated.openChannels[0]?.hasMention).toBe(true);
      expect(migrated.openChannelsShortList[0]?.unReadMessages).toBe(5);
      expect(migrated.openChannelsShortList[0]?.hasMention).toBe(true);
    });

    it('should keep metadata from whichever window carries it', () => {
      const migrated = migrateChannels({
        openChannels: [
          channel('#religie'),
          channel('#Religie', { avatar: 'https://avatar.png', displayName: 'Religie' }),
        ],
        openChannelsShortList: [],
      }, 1);

      expect(migrated.openChannels[0]?.avatar).toBe('https://avatar.png');
      expect(migrated.openChannels[0]?.displayName).toBe('Religie');
    });

    it('should drop stale typing state', () => {
      const migrated = migrateChannels({
        openChannels: [
          channel('#religie', { typing: ['someone'] }),
          channel('#Religie', { typing: ['other'] }),
        ],
        openChannelsShortList: [],
      }, 1);

      expect(migrated.openChannels[0]?.typing).toEqual([]);
    });

    it('should merge DM windows for the same nick', () => {
      const migrated = migrateChannels({
        openChannels: [
          channel('Merovingian', { category: ChannelCategory.priv }),
          channel('merovingian', { category: ChannelCategory.priv }),
        ],
        openChannelsShortList: [],
      }, 1);

      expect(migrated.openChannels.length).toBe(1);
    });

    it('should leave channels that only differ outside ASCII alone', () => {
      // ascii folding is the conservative choice: it must never join two
      // channels a server with another CASEMAPPING considers distinct
      const migrated = migrateChannels({
        openChannels: [channel('#a[b]'), channel('#a{b}')],
        openChannelsShortList: [],
      }, 1);

      expect(migrated.openChannels.length).toBe(2);
    });

    it('should leave an already migrated state untouched', () => {
      const state = { openChannels: [channel('#religie'), channel('#Religie')], openChannelsShortList: [] };

      const migrated = migrateChannels(state, 2);

      expect(migrated.openChannels.length).toBe(2);
    });

    it('should survive persisted state that is missing or malformed', () => {
      expect(migrateChannels({}, 1).openChannels).toEqual([]);
      expect(migrateChannels({ openChannels: 'nonsense' }, 1).openChannels).toEqual([]);
      expect(migrateChannels(undefined, 1).openChannels).toEqual([]);
      expect(migrateChannels({ openChannels: [null, 42, { noName: true }, channel('#ok')] }, 1).openChannels.length).toBe(1);
    });
  });
});
