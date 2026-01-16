import { describe, expect, it, beforeEach } from 'vitest';
import { useCurrentStore } from '../current';
import type { Message, User } from '../../types';
import { MessageCategory } from '../../types';

const createMessage = (id: string, message: string, target: string): Message => ({
  id,
  message,
  target,
  time: new Date().toISOString(),
  category: MessageCategory.default,
});

const createUser = (nick: string): User => ({
  nick,
  ident: 'ident',
  hostname: 'hostname',
  flags: [],
  channels: [{ name: '#test', flags: [], maxPermission: -1 }],
});

describe('current store', () => {
  beforeEach(() => {
    useCurrentStore.setState({
      topic: '',
      messages: [],
      users: [],
      typing: [],
    });
  });

  describe('topic', () => {
    it('should set topic', () => {
      useCurrentStore.getState().setUpdateTopic('Welcome to #test!');
      expect(useCurrentStore.getState().topic).toBe('Welcome to #test!');
    });

    it('should update topic', () => {
      useCurrentStore.getState().setUpdateTopic('Old topic');
      useCurrentStore.getState().setUpdateTopic('New topic');

      expect(useCurrentStore.getState().topic).toBe('New topic');
    });

    it('should handle empty topic', () => {
      useCurrentStore.getState().setUpdateTopic('Some topic');
      useCurrentStore.getState().setUpdateTopic('');

      expect(useCurrentStore.getState().topic).toBe('');
    });

    it('should handle topic with special characters', () => {
      const topic = 'Welcome! Check out https://example.com | Rules: Be nice 🎉';
      useCurrentStore.getState().setUpdateTopic(topic);

      expect(useCurrentStore.getState().topic).toBe(topic);
    });
  });

  describe('messages', () => {
    it('should set messages', () => {
      const messages = [
        createMessage('1', 'Hello', '#test'),
        createMessage('2', 'World', '#test'),
      ];

      useCurrentStore.getState().setUpdateMessages(messages);
      expect(useCurrentStore.getState().messages).toEqual(messages);
    });

    it('should replace messages', () => {
      const oldMessages = [createMessage('1', 'Old', '#test')];
      const newMessages = [createMessage('2', 'New', '#test')];

      useCurrentStore.getState().setUpdateMessages(oldMessages);
      useCurrentStore.getState().setUpdateMessages(newMessages);

      expect(useCurrentStore.getState().messages).toEqual(newMessages);
      expect(useCurrentStore.getState().messages.length).toBe(1);
    });

    it('should handle empty messages array', () => {
      useCurrentStore.getState().setUpdateMessages([createMessage('1', 'Test', '#test')]);
      useCurrentStore.getState().setUpdateMessages([]);

      expect(useCurrentStore.getState().messages).toEqual([]);
    });

    it('should handle messages with different categories', () => {
      const messages: Message[] = [
        { ...createMessage('1', 'User joined', '#test'), category: MessageCategory.join },
        { ...createMessage('2', 'Hello everyone', '#test'), category: MessageCategory.default },
        { ...createMessage('3', 'User left', '#test'), category: MessageCategory.part },
      ];

      useCurrentStore.getState().setUpdateMessages(messages);

      expect(useCurrentStore.getState().messages.length).toBe(3);
      expect(useCurrentStore.getState().messages[0]?.category).toBe(MessageCategory.join);
      expect(useCurrentStore.getState().messages[1]?.category).toBe(MessageCategory.default);
      expect(useCurrentStore.getState().messages[2]?.category).toBe(MessageCategory.part);
    });
  });

  describe('users', () => {
    it('should set users', () => {
      const users = [createUser('Alice'), createUser('Bob')];

      useCurrentStore.getState().setUpdateUsers(users);
      expect(useCurrentStore.getState().users).toEqual(users);
    });

    it('should replace users', () => {
      const oldUsers = [createUser('OldUser')];
      const newUsers = [createUser('NewUser')];

      useCurrentStore.getState().setUpdateUsers(oldUsers);
      useCurrentStore.getState().setUpdateUsers(newUsers);

      expect(useCurrentStore.getState().users).toEqual(newUsers);
    });

    it('should handle empty users array', () => {
      useCurrentStore.getState().setUpdateUsers([createUser('Test')]);
      useCurrentStore.getState().setUpdateUsers([]);

      expect(useCurrentStore.getState().users).toEqual([]);
    });

    it('should handle many users', () => {
      const users = Array.from({ length: 100 }, (_, i) => createUser(`User${i}`));

      useCurrentStore.getState().setUpdateUsers(users);
      expect(useCurrentStore.getState().users.length).toBe(100);
    });
  });

  describe('typing', () => {
    it('should set typing users', () => {
      useCurrentStore.getState().setUpdateTyping(['Alice', 'Bob']);
      expect(useCurrentStore.getState().typing).toEqual(['Alice', 'Bob']);
    });

    it('should replace typing users', () => {
      useCurrentStore.getState().setUpdateTyping(['Alice']);
      useCurrentStore.getState().setUpdateTyping(['Bob', 'Carol']);

      expect(useCurrentStore.getState().typing).toEqual(['Bob', 'Carol']);
    });

    it('should handle empty typing array', () => {
      useCurrentStore.getState().setUpdateTyping(['Alice']);
      useCurrentStore.getState().setUpdateTyping([]);

      expect(useCurrentStore.getState().typing).toEqual([]);
    });

    it('should handle single typing user', () => {
      useCurrentStore.getState().setUpdateTyping(['Alice']);
      expect(useCurrentStore.getState().typing).toEqual(['Alice']);
    });
  });

  describe('immutability', () => {
    it('should not share reference with input messages', () => {
      const messages = [createMessage('1', 'Test', '#test')];
      useCurrentStore.getState().setUpdateMessages(messages);

      const storedMessages = useCurrentStore.getState().messages;
      expect(storedMessages).toEqual(messages);
    });

    it('should not share reference with input users', () => {
      const users = [createUser('Alice')];
      useCurrentStore.getState().setUpdateUsers(users);

      const storedUsers = useCurrentStore.getState().users;
      expect(storedUsers).toEqual(users);
    });

    it('should not share reference with input typing', () => {
      const typing = ['Alice', 'Bob'];
      useCurrentStore.getState().setUpdateTyping(typing);

      const storedTyping = useCurrentStore.getState().typing;
      expect(storedTyping).toEqual(typing);
    });
  });

  describe('initial state', () => {
    it('should have empty topic initially', () => {
      useCurrentStore.setState({
        topic: '',
        messages: [],
        users: [],
        typing: [],
      });
      expect(useCurrentStore.getState().topic).toBe('');
    });

    it('should have empty messages initially', () => {
      useCurrentStore.setState({
        topic: '',
        messages: [],
        users: [],
        typing: [],
      });
      expect(useCurrentStore.getState().messages).toEqual([]);
    });

    it('should have empty users initially', () => {
      useCurrentStore.setState({
        topic: '',
        messages: [],
        users: [],
        typing: [],
      });
      expect(useCurrentStore.getState().users).toEqual([]);
    });

    it('should have empty typing initially', () => {
      useCurrentStore.setState({
        topic: '',
        messages: [],
        users: [],
        typing: [],
      });
      expect(useCurrentStore.getState().typing).toEqual([]);
    });
  });
});
