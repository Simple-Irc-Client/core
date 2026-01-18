import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Main from '../Main';
import * as settingsStore from '../../../../store/settings';
import * as currentStore from '../../../../store/current';
import * as ContextMenuContext from '../../../../providers/ContextMenuContext';
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
  const mockHandleContextMenuUserClick = vi.fn();
  const mockHandleContextMenuClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Default context menu mock for all tests
    vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue({
      contextMenuOpen: false,
      handleContextMenuClose: mockHandleContextMenuClose,
      contextMenuAnchorElement: null,
      contextMenuCategory: undefined,
      contextMenuItem: undefined,
      handleContextMenuUserClick: mockHandleContextMenuUserClick,
    });

    // Default channel types mock
    vi.spyOn(settingsStore, 'getChannelTypes').mockReturnValue(['#']);
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

      const { container } = render(<Main />);

      expect(container.textContent).toContain('Hello world');
    });

    it('should render multiple messages', () => {
      setupMocks({
        messages: [
          createMessage({ id: '1', message: 'First message' }),
          createMessage({ id: '2', message: 'Second message' }),
          createMessage({ id: '3', message: 'Third message' }),
        ],
      });

      const { container } = render(<Main />);

      expect(container.textContent).toContain('First message');
      expect(container.textContent).toContain('Second message');
      expect(container.textContent).toContain('Third message');
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

      const { container } = render(<Main />);

      expect(container.textContent).toContain('Debug message');
      expect(container.textContent).toContain('Server');
    });

    it('should render debug view for STATUS_CHANNEL', () => {
      setupMocks({
        currentChannelName: STATUS_CHANNEL,
        messages: [createMessage({ id: '1', message: 'Status message' })],
      });

      const { container } = render(<Main />);

      expect(container.textContent).toContain('Status message');
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

      const { container } = render(<Main />);

      expect(container.textContent).toContain('No nick message');
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

      const { container } = render(<Main />);

      expect(container.textContent).toContain('Colored message');
      // The color is applied to the MessageText span which wraps the message content
      const coloredSpans = container.querySelectorAll(`span[style]`);
      const messageSpan = Array.from(coloredSpans).find(s => s.textContent?.includes('Colored'));
      expect(messageSpan).toHaveStyle({ color: MessageColor.error });
    });
  });

  describe('Classic theme view', () => {
    it('should render classic view when theme is classic', () => {
      setupMocks({
        theme: 'classic',
        messages: [createMessage({ id: '1', message: 'Classic message', nick: 'TestUser' })],
      });

      const { container } = render(<Main />);

      expect(container.textContent).toContain('Classic message');
      expect(container.textContent).toContain('TestUser');
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

      const { container } = render(<Main />);

      expect(container.textContent).toContain('Colored message');
      // The color is applied to the MessageText span which wraps the message content
      const coloredSpans = container.querySelectorAll(`span[style]`);
      const messageSpan = Array.from(coloredSpans).find(s => s.textContent?.includes('Colored'));
      expect(messageSpan).toHaveStyle({ color: MessageColor.join });
    });
  });

  describe('Modern theme view', () => {
    it('should render modern view when theme is modern', () => {
      setupMocks({
        theme: 'modern',
        messages: [createMessage({ id: '1', message: 'Modern message', nick: 'TestUser' })],
      });

      const { container } = render(<Main />);

      expect(container.textContent).toContain('Modern message');
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

      const { container } = render(<Main />);

      expect(container.textContent).toContain('User1');
      expect(container.textContent).toContain('User2');
    });

    it('should show nick again after messages from different user', () => {
      setupMocks({
        theme: 'modern',
        messages: [
          createMessage({ id: '1', message: 'First message', nick: 'User1' }),
          createMessage({ id: '2', message: 'Second message', nick: 'User2' }),
          createMessage({ id: '3', message: 'Third message', nick: 'User1' }),
        ],
      });

      const { container } = render(<Main />);

      // User1 nick should appear twice (before message 1 and message 3)
      // Look for nick spans with font-medium class (these are the header nicks, not message text)
      const nickSpans = container.querySelectorAll('.font-medium');
      const user1Nicks = Array.from(nickSpans).filter(s => s.textContent === 'User1');
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

      const { container } = render(<Main />);

      expect(container.textContent).toContain('Error message');
      // Find the outer div with color style (the message container)
      const coloredDiv = container.querySelector(`div[style*="color"]`);
      expect(coloredDiv).toHaveStyle({ color: MessageColor.error });
    });
  });

  describe('Message categories in modern view', () => {
    it('should render non-default category messages differently', () => {
      setupMocks({
        theme: 'modern',
        messages: [createMessage({ id: '1', message: 'User joined', category: MessageCategory.join, color: MessageColor.join })],
      });

      const { container } = render(<Main />);

      expect(container.textContent).toContain('User joined');
      const coloredDiv = container.querySelector(`div[style*="color"]`);
      expect(coloredDiv).toHaveStyle({ color: MessageColor.join });
    });

    it('should render part message with correct color', () => {
      setupMocks({
        theme: 'modern',
        messages: [createMessage({ id: '1', message: 'User left', category: MessageCategory.part, color: MessageColor.part })],
      });

      const { container } = render(<Main />);

      expect(container.textContent).toContain('User left');
      const coloredDiv = container.querySelector(`div[style*="color"]`);
      expect(coloredDiv).toHaveStyle({ color: MessageColor.part });
    });

    it('should render quit message with correct color', () => {
      setupMocks({
        theme: 'modern',
        messages: [createMessage({ id: '1', message: 'User quit', category: MessageCategory.quit, color: MessageColor.quit })],
      });

      const { container } = render(<Main />);

      expect(container.textContent).toContain('User quit');
      const coloredDiv = container.querySelector(`div[style*="color"]`);
      expect(coloredDiv).toHaveStyle({ color: MessageColor.quit });
    });

    it('should render notice message with correct color', () => {
      setupMocks({
        theme: 'modern',
        messages: [createMessage({ id: '1', message: 'Notice message', category: MessageCategory.notice, color: MessageColor.notice })],
      });

      const { container } = render(<Main />);

      expect(container.textContent).toContain('Notice message');
      const coloredDiv = container.querySelector(`div[style*="color"]`);
      expect(coloredDiv).toHaveStyle({ color: MessageColor.notice });
    });

    it('should render error message with correct color', () => {
      setupMocks({
        theme: 'modern',
        messages: [createMessage({ id: '1', message: 'Error occurred', category: MessageCategory.error, color: MessageColor.error })],
      });

      const { container } = render(<Main />);

      expect(container.textContent).toContain('Error occurred');
      const coloredDiv = container.querySelector(`div[style*="color"]`);
      expect(coloredDiv).toHaveStyle({ color: MessageColor.error });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty nick string', () => {
      setupMocks({
        theme: 'modern',
        messages: [createMessage({ id: '1', message: 'Test', nick: '' })],
      });

      const { container } = render(<Main />);

      expect(container.textContent).toContain('Test');
    });

    it('should handle undefined nick', () => {
      setupMocks({
        theme: 'modern',
        messages: [createMessage({ id: '1', message: 'No nick message', nick: undefined })],
      });

      const { container } = render(<Main />);

      expect(container.textContent).toContain('No nick message');
    });

    it('should handle messages without color', () => {
      setupMocks({
        theme: 'modern',
        messages: [createMessage({ id: '1', message: 'Default color', color: undefined })],
      });

      const { container } = render(<Main />);

      expect(container.textContent).toContain('Default color');
      const coloredDiv = container.querySelector(`div[style*="color"]`);
      expect(coloredDiv).toHaveStyle({ color: MessageColor.default });
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

  describe('Nick context menu', () => {
    it('should trigger context menu on right-click on nick in classic view', () => {
      setupMocks({
        theme: 'classic',
        messages: [createMessage({ id: '1', message: 'Hello', nick: 'TestUser' })],
      });

      render(<Main />);

      const nickElement = screen.getByText('<TestUser>');
      fireEvent.contextMenu(nickElement);

      expect(mockHandleContextMenuUserClick).toHaveBeenCalledWith(
        expect.any(Object),
        'user',
        'TestUser'
      );
    });

    it('should trigger context menu on right-click on nick in debug view', () => {
      setupMocks({
        currentChannelName: DEBUG_CHANNEL,
        messages: [createMessage({ id: '1', message: 'Debug msg', nick: 'DebugUser' })],
      });

      render(<Main />);

      const nickElement = screen.getByText('<DebugUser>');
      fireEvent.contextMenu(nickElement);

      expect(mockHandleContextMenuUserClick).toHaveBeenCalledWith(
        expect.any(Object),
        'user',
        'DebugUser'
      );
    });

    it('should trigger context menu on right-click on nick in modern view', () => {
      setupMocks({
        theme: 'modern',
        messages: [createMessage({ id: '1', message: 'Hello', nick: 'ModernUser' })],
      });

      render(<Main />);

      const nickElement = screen.getByText('ModernUser');
      fireEvent.contextMenu(nickElement);

      expect(mockHandleContextMenuUserClick).toHaveBeenCalledWith(
        expect.any(Object),
        'user',
        'ModernUser'
      );
    });

    it('should trigger context menu on right-click on avatar in modern view', () => {
      setupMocks({
        theme: 'modern',
        messages: [
          createMessage({
            id: '1',
            message: 'Hello',
            nick: createUserNick({ nick: 'AvatarUser', avatar: 'http://example.com/avatar.png' }),
          }),
        ],
      });

      render(<Main />);

      const avatarContainer = screen.getByRole('img').parentElement;
      expect(avatarContainer).not.toBeNull();
      fireEvent.contextMenu(avatarContainer!);

      expect(mockHandleContextMenuUserClick).toHaveBeenCalledWith(
        expect.any(Object),
        'user',
        'AvatarUser'
      );
    });

    it('should have cursor-pointer class on clickable nick elements', () => {
      setupMocks({
        theme: 'classic',
        messages: [createMessage({ id: '1', message: 'Hello', nick: 'TestUser' })],
      });

      render(<Main />);

      const nickElement = screen.getByText('<TestUser>');
      expect(nickElement).toHaveClass('cursor-pointer');
    });

    it('should have hover:underline class on clickable nick elements', () => {
      setupMocks({
        theme: 'classic',
        messages: [createMessage({ id: '1', message: 'Hello', nick: 'TestUser' })],
      });

      render(<Main />);

      const nickElement = screen.getByText('<TestUser>');
      expect(nickElement).toHaveClass('hover:underline');
    });

    it('should handle User object nick for context menu in modern view', () => {
      setupMocks({
        theme: 'modern',
        messages: [
          createMessage({
            id: '1',
            message: 'Hello',
            nick: createUserNick({ nick: 'ObjectUser', color: '#ff0000' }),
          }),
        ],
      });

      render(<Main />);

      const nickElement = screen.getByText('ObjectUser');
      fireEvent.contextMenu(nickElement);

      expect(mockHandleContextMenuUserClick).toHaveBeenCalledWith(
        expect.any(Object),
        'user',
        'ObjectUser'
      );
    });
  });
});
