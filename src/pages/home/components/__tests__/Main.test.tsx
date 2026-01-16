import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import Main from '../Main';
import * as settingsStore from '../../../../store/settings';
import * as currentStore from '../../../../store/current';
import { MessageCategory, type Message, type User } from '../../../../types';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '../../../../config/config';
import { MessageColor } from '../../../../config/theme';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const createMessage = (overrides: Partial<Message> & { id: string }): Message => ({
  message: 'Test message',
  target: '#test',
  time: '2024-01-01T12:00:00Z',
  category: MessageCategory.default,
  ...overrides,
});

const createUserNick = (overrides: Partial<User> = {}): User => ({
  nick: 'TestUser',
  ident: 'ident',
  hostname: 'host',
  flags: [],
  channels: [],
  ...overrides,
});

describe('Main', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMocks = (overrides: {
    currentChannelName?: string;
    theme?: string;
    messages?: Message[];
  } = {}) => {
    const {
      currentChannelName = '#test',
      theme = 'modern',
      messages = [],
    } = overrides;

    vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
      selector({
        currentChannelName,
        theme,
      } as unknown as settingsStore.SettingsStore)
    );

    vi.spyOn(currentStore, 'useCurrentStore').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (selector: any) => selector({ messages })
    );
  };

  describe('Basic rendering', () => {
    it('should render without messages', () => {
      setupMocks({ messages: [] });

      render(<Main />);

      expect(screen.queryByText('Test message')).not.toBeInTheDocument();
    });

    it('should render messages', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Hello world' })],
      });

      render(<Main />);

      expect(screen.getByText('Hello world')).toBeInTheDocument();
    });

    it('should render multiple messages', () => {
      setupMocks({
        messages: [
          createMessage({ id: '1', message: 'First message' }),
          createMessage({ id: '2', message: 'Second message' }),
          createMessage({ id: '3', message: 'Third message' }),
        ],
      });

      render(<Main />);

      expect(screen.getByText('First message')).toBeInTheDocument();
      expect(screen.getByText('Second message')).toBeInTheDocument();
      expect(screen.getByText('Third message')).toBeInTheDocument();
    });

    it('should call scrollIntoView on render', () => {
      setupMocks({ messages: [createMessage({ id: '1' })] });

      render(<Main />);

      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });
  });

  describe('Debug channel view', () => {
    it('should render debug view for DEBUG_CHANNEL', () => {
      setupMocks({
        currentChannelName: DEBUG_CHANNEL,
        messages: [createMessage({ id: '1', message: 'Debug message', nick: 'Server' })],
      });

      render(<Main />);

      expect(screen.getByText('Debug message')).toBeInTheDocument();
      expect(screen.getByText(/Server/)).toBeInTheDocument();
    });

    it('should render debug view for STATUS_CHANNEL', () => {
      setupMocks({
        currentChannelName: STATUS_CHANNEL,
        messages: [createMessage({ id: '1', message: 'Status message' })],
      });

      render(<Main />);

      expect(screen.getByText('Status message')).toBeInTheDocument();
    });

    it('should show time with seconds in debug view', () => {
      setupMocks({
        currentChannelName: DEBUG_CHANNEL,
        messages: [createMessage({ id: '1', time: '2024-01-01T12:34:56Z' })],
      });

      render(<Main />);

      // Time format should be HH:mm:ss (with seconds)
      expect(screen.getByText(/\d{2}:\d{2}:\d{2}/)).toBeInTheDocument();
    });

    it('should render message without nick in debug view', () => {
      setupMocks({
        currentChannelName: DEBUG_CHANNEL,
        messages: [createMessage({ id: '1', message: 'No nick message', nick: undefined })],
      });

      render(<Main />);

      expect(screen.getByText('No nick message')).toBeInTheDocument();
    });

    it('should render message with User object nick in debug view', () => {
      setupMocks({
        currentChannelName: DEBUG_CHANNEL,
        messages: [
          createMessage({
            id: '1',
            message: 'User object message',
            nick: createUserNick({ nick: 'UserNick' }),
          }),
        ],
      });

      render(<Main />);

      expect(screen.getByText(/UserNick/)).toBeInTheDocument();
    });

    it('should apply custom color to debug message', () => {
      setupMocks({
        currentChannelName: DEBUG_CHANNEL,
        messages: [createMessage({ id: '1', message: 'Colored message', color: MessageColor.error })],
      });

      render(<Main />);

      const message = screen.getByText('Colored message');
      expect(message).toHaveStyle({ color: MessageColor.error });
    });
  });

  describe('Classic theme view', () => {
    it('should render classic view when theme is classic', () => {
      setupMocks({
        theme: 'classic',
        messages: [createMessage({ id: '1', message: 'Classic message', nick: 'TestUser' })],
      });

      render(<Main />);

      expect(screen.getByText('Classic message')).toBeInTheDocument();
      expect(screen.getByText(/TestUser/)).toBeInTheDocument();
    });

    it('should show time without seconds in classic view', () => {
      setupMocks({
        theme: 'classic',
        messages: [createMessage({ id: '1', time: '2024-01-01T12:34:56Z' })],
      });

      render(<Main />);

      // Time format should be HH:mm (without seconds) - match exactly 5 chars for HH:mm
      const timeElement = screen.getByText(/^\d{2}:\d{2}$/);
      expect(timeElement).toBeInTheDocument();
    });

    it('should render message with User object nick in classic view', () => {
      setupMocks({
        theme: 'classic',
        messages: [
          createMessage({
            id: '1',
            message: 'User message',
            nick: createUserNick({ nick: 'ClassicUser' }),
          }),
        ],
      });

      render(<Main />);

      expect(screen.getByText(/ClassicUser/)).toBeInTheDocument();
    });

    it('should apply custom color to classic message', () => {
      setupMocks({
        theme: 'classic',
        messages: [createMessage({ id: '1', message: 'Colored message', color: MessageColor.join })],
      });

      render(<Main />);

      const message = screen.getByText('Colored message');
      expect(message).toHaveStyle({ color: MessageColor.join });
    });
  });

  describe('Modern theme view', () => {
    it('should render modern view when theme is modern', () => {
      setupMocks({
        theme: 'modern',
        messages: [createMessage({ id: '1', message: 'Modern message', nick: 'TestUser' })],
      });

      render(<Main />);

      expect(screen.getByText('Modern message')).toBeInTheDocument();
    });

    it('should show nick for first message from user', () => {
      setupMocks({
        theme: 'modern',
        messages: [createMessage({ id: '1', message: 'First message', nick: 'TestUser' })],
      });

      render(<Main />);

      expect(screen.getByText('TestUser')).toBeInTheDocument();
    });

    it('should group consecutive messages from same user', () => {
      setupMocks({
        theme: 'modern',
        messages: [
          createMessage({ id: '1', message: 'First message', nick: 'SameUser' }),
          createMessage({ id: '2', message: 'Second message', nick: 'SameUser' }),
        ],
      });

      render(<Main />);

      // Nick should appear only once
      const nicks = screen.getAllByText('SameUser');
      expect(nicks.length).toBe(1);
    });

    it('should show nick again when different user sends message', () => {
      setupMocks({
        theme: 'modern',
        messages: [
          createMessage({ id: '1', message: 'User1 message', nick: 'User1' }),
          createMessage({ id: '2', message: 'User2 message', nick: 'User2' }),
        ],
      });

      render(<Main />);

      expect(screen.getByText('User1')).toBeInTheDocument();
      expect(screen.getByText('User2')).toBeInTheDocument();
    });

    it('should show nick again after messages from different user', () => {
      setupMocks({
        theme: 'modern',
        messages: [
          createMessage({ id: '1', message: 'First from User1', nick: 'User1' }),
          createMessage({ id: '2', message: 'From User2', nick: 'User2' }),
          createMessage({ id: '3', message: 'Second from User1', nick: 'User1' }),
        ],
      });

      render(<Main />);

      // User1 nick should appear twice (before message 1 and message 3)
      const user1Nicks = screen.getAllByText('User1');
      expect(user1Nicks.length).toBe(2);
    });

    it('should display avatar letter when no avatar image', () => {
      setupMocks({
        theme: 'modern',
        messages: [createMessage({ id: '1', message: 'Test', nick: 'TestUser' })],
      });

      render(<Main />);

      expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('should display avatar letter from User object', () => {
      setupMocks({
        theme: 'modern',
        messages: [
          createMessage({
            id: '1',
            message: 'Test',
            nick: createUserNick({ nick: 'AvatarUser' }),
          }),
        ],
      });

      render(<Main />);

      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('should display avatar image when available', () => {
      setupMocks({
        theme: 'modern',
        messages: [
          createMessage({
            id: '1',
            message: 'Test',
            nick: createUserNick({ nick: 'ImageUser', avatar: 'http://example.com/avatar.png' }),
          }),
        ],
      });

      render(<Main />);

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'http://example.com/avatar.png');
      expect(img).toHaveAttribute('alt', 'ImageUser');
    });

    it('should apply nick color from User object', () => {
      setupMocks({
        theme: 'modern',
        messages: [
          createMessage({
            id: '1',
            message: 'Colored nick message',
            nick: createUserNick({ nick: 'ColoredUser', color: '#ff0000' }),
          }),
        ],
      });

      render(<Main />);

      const nick = screen.getByText('ColoredUser');
      expect(nick).toHaveStyle({ color: '#ff0000' });
    });

    it('should apply message color', () => {
      setupMocks({
        theme: 'modern',
        messages: [createMessage({ id: '1', message: 'Error message', color: MessageColor.error })],
      });

      render(<Main />);

      const message = screen.getByText('Error message');
      expect(message).toHaveStyle({ color: MessageColor.error });
    });
  });

  describe('Message categories in modern view', () => {
    it('should render non-default category messages differently', () => {
      setupMocks({
        theme: 'modern',
        messages: [createMessage({ id: '1', message: 'User joined', category: MessageCategory.join, color: MessageColor.join })],
      });

      render(<Main />);

      const message = screen.getByText('User joined');
      expect(message).toHaveStyle({ color: MessageColor.join });
    });

    it('should render part message with correct color', () => {
      setupMocks({
        theme: 'modern',
        messages: [createMessage({ id: '1', message: 'User left', category: MessageCategory.part, color: MessageColor.part })],
      });

      render(<Main />);

      const message = screen.getByText('User left');
      expect(message).toHaveStyle({ color: MessageColor.part });
    });

    it('should render quit message with correct color', () => {
      setupMocks({
        theme: 'modern',
        messages: [createMessage({ id: '1', message: 'User quit', category: MessageCategory.quit, color: MessageColor.quit })],
      });

      render(<Main />);

      const message = screen.getByText('User quit');
      expect(message).toHaveStyle({ color: MessageColor.quit });
    });

    it('should render notice message with correct color', () => {
      setupMocks({
        theme: 'modern',
        messages: [createMessage({ id: '1', message: 'Notice message', category: MessageCategory.notice, color: MessageColor.notice })],
      });

      render(<Main />);

      const message = screen.getByText('Notice message');
      expect(message).toHaveStyle({ color: MessageColor.notice });
    });

    it('should render error message with correct color', () => {
      setupMocks({
        theme: 'modern',
        messages: [createMessage({ id: '1', message: 'Error occurred', category: MessageCategory.error, color: MessageColor.error })],
      });

      render(<Main />);

      const message = screen.getByText('Error occurred');
      expect(message).toHaveStyle({ color: MessageColor.error });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty nick string', () => {
      setupMocks({
        theme: 'modern',
        messages: [createMessage({ id: '1', message: 'Test', nick: '' })],
      });

      render(<Main />);

      expect(screen.getByText('Test')).toBeInTheDocument();
    });

    it('should handle undefined nick', () => {
      setupMocks({
        theme: 'modern',
        messages: [createMessage({ id: '1', message: 'No nick message', nick: undefined })],
      });

      render(<Main />);

      expect(screen.getByText('No nick message')).toBeInTheDocument();
    });

    it('should handle messages without color', () => {
      setupMocks({
        theme: 'modern',
        messages: [createMessage({ id: '1', message: 'Default color', color: undefined })],
      });

      render(<Main />);

      const message = screen.getByText('Default color');
      expect(message).toHaveStyle({ color: MessageColor.default });
    });

    it('should use debug view only for debug/status channels', () => {
      setupMocks({
        currentChannelName: '#regular',
        theme: 'modern',
        messages: [createMessage({ id: '1', time: '2024-01-01T12:34:56Z' })],
      });

      render(<Main />);

      // Regular channel should show HH:mm format (without seconds)
      const timeElement = screen.getByText(/^\d{2}:\d{2}$/);
      expect(timeElement).toBeInTheDocument();
      // Should not have seconds format
      expect(screen.queryByText(/^\d{2}:\d{2}:\d{2}$/)).not.toBeInTheDocument();
    });
  });

  describe('Message deduplication (lastNick logic)', () => {
    it('should not show avatar for consecutive messages from same user', () => {
      setupMocks({
        theme: 'modern',
        messages: [
          createMessage({ id: '1', message: 'First', nick: createUserNick({ nick: 'User1', avatar: 'http://example.com/a.png' }) }),
          createMessage({ id: '2', message: 'Second', nick: createUserNick({ nick: 'User1', avatar: 'http://example.com/a.png' }) }),
        ],
      });

      render(<Main />);

      // Only one avatar should be rendered
      const avatars = screen.getAllByRole('img');
      expect(avatars.length).toBe(1);
    });

    it('should show avatar for each new user in conversation', () => {
      setupMocks({
        theme: 'modern',
        messages: [
          createMessage({ id: '1', message: 'User1 msg', nick: createUserNick({ nick: 'User1', avatar: 'http://example.com/a.png' }) }),
          createMessage({ id: '2', message: 'User2 msg', nick: createUserNick({ nick: 'User2', avatar: 'http://example.com/b.png' }) }),
        ],
      });

      render(<Main />);

      const avatars = screen.getAllByRole('img');
      expect(avatars.length).toBe(2);
    });

    it('should handle mixed string and User object nicks for grouping', () => {
      setupMocks({
        theme: 'modern',
        messages: [
          createMessage({ id: '1', message: 'First', nick: 'TestUser' }),
          createMessage({ id: '2', message: 'Second', nick: createUserNick({ nick: 'TestUser' }) }),
        ],
      });

      render(<Main />);

      // Same nick should be grouped (only one nick display)
      const nicks = screen.getAllByText('TestUser');
      expect(nicks.length).toBe(1);
    });
  });
});
