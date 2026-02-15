import { describe, expect, it, beforeEach } from 'vitest';
import {
  useAwayMessagesStore,
  addAwayMessage,
  clearAwayMessages,
  getAwayMessages,
  getAwayMessagesCount,
  type AwayMessage,
} from '../awayMessages';
import { MessageCategory } from '@shared/types';
import { MessageColor } from '@/config/theme';

describe('awayMessages store', () => {
  beforeEach(() => {
    useAwayMessagesStore.setState({
      messages: [],
    });
  });

  const createAwayMessage = (overrides: Partial<AwayMessage> = {}): AwayMessage => ({
    id: 'test-id-1',
    message: 'Hey @testUser, are you there?',
    nick: 'sender',
    target: '#test-channel',
    time: '2024-01-01T12:00:00.000Z',
    category: MessageCategory.default,
    color: MessageColor.default,
    channel: '#test-channel',
    ...overrides,
  });

  describe('addAwayMessage', () => {
    it('should add a message to the store', () => {
      const message = createAwayMessage();
      addAwayMessage(message);

      const messages = useAwayMessagesStore.getState().messages;
      expect(messages.length).toBe(1);
      expect(messages[0]).toEqual(message);
    });

    it('should add multiple messages', () => {
      const message1 = createAwayMessage({ id: 'msg-1', message: 'First mention' });
      const message2 = createAwayMessage({ id: 'msg-2', message: 'Second mention' });
      const message3 = createAwayMessage({ id: 'msg-3', message: 'Third mention' });

      addAwayMessage(message1);
      addAwayMessage(message2);
      addAwayMessage(message3);

      const messages = useAwayMessagesStore.getState().messages;
      expect(messages.length).toBe(3);
      expect(messages[0]?.id).toBe('msg-1');
      expect(messages[1]?.id).toBe('msg-2');
      expect(messages[2]?.id).toBe('msg-3');
    });

    it('should preserve message order (oldest first)', () => {
      const message1 = createAwayMessage({ id: 'msg-1', time: '2024-01-01T12:00:00.000Z' });
      const message2 = createAwayMessage({ id: 'msg-2', time: '2024-01-01T12:01:00.000Z' });

      addAwayMessage(message1);
      addAwayMessage(message2);

      const messages = useAwayMessagesStore.getState().messages;
      expect(messages[0]?.id).toBe('msg-1');
      expect(messages[1]?.id).toBe('msg-2');
    });

    it('should handle messages from different channels', () => {
      const message1 = createAwayMessage({ id: 'msg-1', channel: '#channel1', target: '#channel1' });
      const message2 = createAwayMessage({ id: 'msg-2', channel: '#channel2', target: '#channel2' });

      addAwayMessage(message1);
      addAwayMessage(message2);

      const messages = useAwayMessagesStore.getState().messages;
      expect(messages.length).toBe(2);
      expect(messages[0]?.channel).toBe('#channel1');
      expect(messages[1]?.channel).toBe('#channel2');
    });

    it('should handle messages with User object as nick', () => {
      const userNick = {
        nick: 'sender',
        ident: 'user',
        hostname: 'host.example.com',
        flags: [],
        channels: [],
      };
      const message = createAwayMessage({ nick: userNick });

      addAwayMessage(message);

      const messages = useAwayMessagesStore.getState().messages;
      expect(messages[0]?.nick).toEqual(userNick);
    });

    it('should handle messages with string nick', () => {
      const message = createAwayMessage({ nick: 'simpleNick' });

      addAwayMessage(message);

      const messages = useAwayMessagesStore.getState().messages;
      expect(messages[0]?.nick).toBe('simpleNick');
    });
  });

  describe('clearAwayMessages', () => {
    it('should clear all messages', () => {
      addAwayMessage(createAwayMessage({ id: 'msg-1' }));
      addAwayMessage(createAwayMessage({ id: 'msg-2' }));
      addAwayMessage(createAwayMessage({ id: 'msg-3' }));

      expect(useAwayMessagesStore.getState().messages.length).toBe(3);

      clearAwayMessages();

      expect(useAwayMessagesStore.getState().messages.length).toBe(0);
    });

    it('should work when already empty', () => {
      expect(useAwayMessagesStore.getState().messages.length).toBe(0);

      clearAwayMessages();

      expect(useAwayMessagesStore.getState().messages.length).toBe(0);
    });
  });

  describe('getAwayMessages', () => {
    it('should return empty array when no messages', () => {
      const messages = getAwayMessages();
      expect(messages).toEqual([]);
    });

    it('should return all messages', () => {
      const message1 = createAwayMessage({ id: 'msg-1' });
      const message2 = createAwayMessage({ id: 'msg-2' });

      addAwayMessage(message1);
      addAwayMessage(message2);

      const messages = getAwayMessages();
      expect(messages.length).toBe(2);
      expect(messages[0]).toEqual(message1);
      expect(messages[1]).toEqual(message2);
    });
  });

  describe('getAwayMessagesCount', () => {
    it('should return 0 when no messages', () => {
      expect(getAwayMessagesCount()).toBe(0);
    });

    it('should return correct count', () => {
      addAwayMessage(createAwayMessage({ id: 'msg-1' }));
      expect(getAwayMessagesCount()).toBe(1);

      addAwayMessage(createAwayMessage({ id: 'msg-2' }));
      expect(getAwayMessagesCount()).toBe(2);

      addAwayMessage(createAwayMessage({ id: 'msg-3' }));
      expect(getAwayMessagesCount()).toBe(3);
    });

    it('should return 0 after clearing', () => {
      addAwayMessage(createAwayMessage({ id: 'msg-1' }));
      addAwayMessage(createAwayMessage({ id: 'msg-2' }));

      expect(getAwayMessagesCount()).toBe(2);

      clearAwayMessages();

      expect(getAwayMessagesCount()).toBe(0);
    });
  });

  describe('limits', () => {
    it('should cap away messages at 1000', () => {
      for (let i = 0; i < 1_050; i++) {
        addAwayMessage(createAwayMessage({ id: `msg-${i}` }));
      }

      expect(useAwayMessagesStore.getState().messages.length).toBe(1_000);
    });
  });

  describe('useAwayMessagesStore direct access', () => {
    it('should allow direct state manipulation', () => {
      const message = createAwayMessage();

      useAwayMessagesStore.getState().addAwayMessage(message);

      expect(useAwayMessagesStore.getState().messages.length).toBe(1);
    });

    it('should allow direct clear', () => {
      addAwayMessage(createAwayMessage());
      expect(useAwayMessagesStore.getState().messages.length).toBe(1);

      useAwayMessagesStore.getState().clearAwayMessages();

      expect(useAwayMessagesStore.getState().messages.length).toBe(0);
    });
  });
});
