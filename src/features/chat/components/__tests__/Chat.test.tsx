import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Main from '@features/chat/components/Chat';
import * as settingsStore from '@features/settings/store/settings';
import * as currentStore from '@features/chat/store/current';
import * as ContextMenuContext from '@/providers/ContextMenuContext';
import { MessageCategory, type Message, type User } from '@shared/types';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';

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

// The chat renders one unified DOM per message (see ChatMessage.tsx); the active
// theme's CSS decides which parts are visible. jsdom does not apply CSS, so these
// tests assert the DOM contract (sic-* class names + data attributes), not the
// visual outcome of a particular theme.
const getMessages = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('.sic-msg')];
const getHeaderNick = (container: HTMLElement) => container.querySelector<HTMLElement>('.sic-msg-header .sic-msg-nick');
const getInlineNick = (container: HTMLElement) => container.querySelector<HTMLElement>('.sic-msg-nick-inline');
const getBody = (container: HTMLElement) => container.querySelector<HTMLElement>('.sic-msg-body');

describe('Chat tests', () => {
  const mockHandleContextMenuUserClick = vi.fn();
  const mockHandleContextMenuClose = vi.fn();
  let resizeObserverCallback: ResizeObserverCallback;
  const mockResizeObserverDisconnect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock ResizeObserver
    globalThis.ResizeObserver = class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback;
      }
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = mockResizeObserverDisconnect;
    } as unknown as typeof ResizeObserver;

    // Default context menu mock for all tests
    vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue({
      contextMenuOpen: false,
      handleContextMenuClose: mockHandleContextMenuClose,
      contextMenuAnchorElement: null,
      contextMenuCategory: undefined,
      contextMenuItem: undefined,
      handleContextMenuUserClick: mockHandleContextMenuUserClick,
      contextMenuPosition: null,
    });

    // Default channel types mock
    vi.spyOn(settingsStore, 'getChannelTypes').mockReturnValue(['#']);
  });

  const setupMocks = (overrides: {
    currentChannelName?: string;
    theme?: string;
    messages?: Message[];
    isConnected?: boolean;
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
        isConnected: overrides.isConnected ?? true,
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

    it('should scroll to bottom on render', () => {
      setupMocks({ messages: [createMessage({ id: '1' })] });

      const { container } = render(<Main />);
      const scrollContainer = container.firstChild as HTMLDivElement;

      // scrollTop should be set to scrollHeight (scroll to bottom)
      expect(scrollContainer.scrollTop).toBe(scrollContainer.scrollHeight);
    });
  });

  describe('Unified message DOM', () => {
    it('should render one .sic-msg element with data-category per message', () => {
      setupMocks({
        messages: [
          createMessage({ id: '1', message: 'Hello', nick: 'TestUser' }),
          createMessage({ id: '2', message: 'Joined', nick: 'Other', category: MessageCategory.join }),
        ],
      });

      const { container } = render(<Main />);

      const messages = getMessages(container);
      expect(messages).toHaveLength(2);
      expect(messages[0]).toHaveAttribute('data-category', 'default');
      expect(messages[1]).toHaveAttribute('data-category', 'join');
    });

    it('should mark content categories with data-content', () => {
      setupMocks({
        messages: [
          createMessage({ id: '1', message: 'Hello', nick: 'TestUser', category: MessageCategory.default }),
          createMessage({ id: '2', message: 'Joined', nick: 'Other', category: MessageCategory.join }),
        ],
      });

      const { container } = render(<Main />);

      const messages = getMessages(container);
      expect(messages[0]).toHaveAttribute('data-content');
      expect(messages[1]).not.toHaveAttribute('data-content');
    });

    it('should render identical DOM regardless of the active theme', () => {
      const messages = [
        createMessage({ id: '1', message: 'Hello', nick: createUserNick({ nick: 'TestUser' }) }),
        createMessage({ id: '2', message: 'Joined', nick: 'Other', category: MessageCategory.join, color: MessageColor.join }),
      ];

      setupMocks({ theme: 'classic', messages });
      const classic = render(<Main />).container.innerHTML;

      setupMocks({ theme: 'modern', messages });
      const modern = render(<Main />).container.innerHTML;

      setupMocks({ theme: 'b1946ac9-2f77-4c47-ac25-b7a4f9f0be55', messages });
      const custom = render(<Main />).container.innerHTML;

      expect(classic).toBe(modern);
      expect(classic).toBe(custom);
    });

    it('should render the timestamp in header, inline and trailing slots with a separate seconds span', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Hello', nick: 'TestUser', time: '2024-01-01T12:34:56Z' })],
      });

      const { container } = render(<Main />);

      const header = container.querySelector('.sic-msg-time-header');
      const inline = container.querySelector('.sic-msg-time-inline');
      const trailing = container.querySelector('.sic-msg-time-trailing');
      for (const slot of [header, inline, trailing]) {
        expect(slot).toBeInTheDocument();
        expect(slot?.textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/);
        expect(slot?.querySelector('.sic-msg-time-seconds')?.textContent).toMatch(/^:\d{2}$/);
      }
    });

    it('should render the nick without angle brackets (brackets are theme CSS)', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Hello', nick: 'TestUser' })],
      });

      const { container } = render(<Main />);

      expect(getHeaderNick(container)?.textContent).toBe('TestUser');
      expect(getInlineNick(container)?.textContent).toBe('TestUser');
      expect(container.textContent).not.toContain('<TestUser>');
    });

    it('should not render an inline nick for italic categories', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'JoinUser joined', nick: 'JoinUser', category: MessageCategory.join })],
      });

      const { container } = render(<Main />);

      expect(getInlineNick(container)).not.toBeInTheDocument();
    });

    it('should apply the message color inline on the body', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Colored message', color: MessageColor.join })],
      });

      const { container } = render(<Main />);

      expect(getBody(container)).toHaveStyle({ color: MessageColor.join });
    });

    it('should not set an inline body color when the message has none (theme CSS decides)', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Default color', color: undefined })],
      });

      const { container } = render(<Main />);

      expect(getBody(container)?.style.color).toBe('');
    });

    it('should render embeds inside .sic-msg-embeds', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Hello', nick: 'TestUser' })],
      });

      const { container } = render(<Main />);

      expect(container.querySelector('.sic-msg-embeds')).toBeInTheDocument();
    });

    it('should display avatar letter when no avatar image', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Test', nick: 'TestUser' })],
      });

      render(<Main />);

      expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('should display avatar letter from User object', () => {
      setupMocks({
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
        messages: [
          createMessage({
            id: '1',
            message: 'Test',
            nick: createUserNick({ nick: 'ImageUser', avatar: 'https://example.com/avatar.png' }),
          }),
        ],
      });

      render(<Main />);

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.png');
      expect(img).toHaveAttribute('alt', 'ImageUser');
    });

    it('should display fallback letter when avatar fails to load', () => {
      setupMocks({
        messages: [
          createMessage({
            id: '1',
            message: 'Test',
            nick: createUserNick({ nick: 'BrokenAvatar', avatar: 'https://example.com/broken.png' }),
          }),
        ],
      });

      render(<Main />);

      // Initially shows the image
      const img = screen.getByRole('img');
      expect(img).toBeInTheDocument();

      // Simulate image load error (404 or network error)
      fireEvent.error(img);

      // After error, should show fallback letter instead of image
      expect(screen.getByText('B')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('should apply nick color from User object to both nick slots', () => {
      setupMocks({
        messages: [
          createMessage({
            id: '1',
            message: 'Colored nick message',
            nick: createUserNick({ nick: 'ColoredUser', color: '#ff0000' }),
          }),
        ],
      });

      const { container } = render(<Main />);

      expect(getHeaderNick(container)).toHaveStyle({ color: '#ff0000' });
      expect(getInlineNick(container)).toHaveStyle({ color: '#ff0000' });
    });

    it('should not render the avatar column content for non-content categories', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'User joined', nick: 'User', category: MessageCategory.join })],
      });

      const { container } = render(<Main />);

      expect(container.querySelector('.sic-msg-gutter')).toBeInTheDocument();
      expect(container.querySelector('.sic-msg-avatar')).not.toBeInTheDocument();
      expect(container.querySelector('.sic-msg-header')).not.toBeInTheDocument();
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
      expect(container.querySelector('.sic-msg')).toHaveAttribute('data-debug');
    });

    it('should render debug view for STATUS_CHANNEL', () => {
      setupMocks({
        currentChannelName: STATUS_CHANNEL,
        messages: [createMessage({ id: '1', message: 'Status message' })],
      });

      const { container } = render(<Main />);

      expect(container.textContent).toContain('Status message');
      expect(container.querySelector('.sic-msg')).toHaveAttribute('data-debug');
    });

    it('should render the seconds span shown by the fixed debug styling', () => {
      setupMocks({
        currentChannelName: DEBUG_CHANNEL,
        messages: [createMessage({ id: '1', time: '2024-01-01T12:34:56Z' })],
      });

      const { container } = render(<Main />);

      const time = container.querySelector('.sic-msg[data-debug] .sic-msg-time-inline');
      expect(time?.textContent).toMatch(/^\d{2}:\d{2}:\d{2}$/);
      expect(time?.querySelector('.sic-msg-time-seconds')?.textContent).toMatch(/^:\d{2}$/);
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
      expect(getBody(container)).toHaveStyle({ color: MessageColor.error });
    });

    it('should not render avatar, header or embeds in debug view', () => {
      setupMocks({
        currentChannelName: DEBUG_CHANNEL,
        messages: [createMessage({ id: '1', message: 'Debug message', nick: createUserNick({ nick: 'Server', avatar: 'https://example.com/a.png' }) })],
      });

      const { container } = render(<Main />);

      expect(container.querySelector('.sic-msg-avatar')).not.toBeInTheDocument();
      expect(container.querySelector('.sic-msg-header')).not.toBeInTheDocument();
      expect(container.querySelector('.sic-msg-embeds')).not.toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  describe('Message categories', () => {
    it.each([
      ['join', MessageCategory.join, MessageColor.join, 'User joined'],
      ['part', MessageCategory.part, MessageColor.part, 'User left'],
      ['quit', MessageCategory.quit, MessageColor.quit, 'User quit'],
      ['error', MessageCategory.error, MessageColor.error, 'Error occurred'],
    ])('should render %s message with its color on the body', (_name, category, color, text) => {
      setupMocks({
        messages: [createMessage({ id: '1', message: text, category, color })],
      });

      const { container } = render(<Main />);

      expect(container.textContent).toContain(text);
      expect(getBody(container)).toHaveStyle({ color });
    });

    describe('notice messages (MessageCategory.notice)', () => {
      it('should render notice message with correct color', () => {
        setupMocks({
          messages: [createMessage({ id: '1', message: 'Notice message', category: MessageCategory.notice, color: MessageColor.notice })],
        });

        const { container } = render(<Main />);

        expect(container.textContent).toContain('Notice message');
        expect(getBody(container)).toHaveStyle({ color: MessageColor.notice });
      });

      it('should show nick for notice messages', () => {
        setupMocks({
          messages: [
            createMessage({
              id: '1',
              message: 'You must be registered',
              nick: createUserNick({ nick: 'NickServ' }),
              category: MessageCategory.notice,
              color: MessageColor.notice,
            }),
          ],
        });

        const { container } = render(<Main />);

        expect(getHeaderNick(container)?.textContent).toBe('NickServ');
      });

      it('should show avatar for notice messages with avatar', () => {
        setupMocks({
          messages: [
            createMessage({
              id: '1',
              message: 'Channel notice',
              nick: createUserNick({ nick: 'Pomocnik', avatar: 'https://example.com/bot.png' }),
              category: MessageCategory.notice,
              color: MessageColor.notice,
            }),
          ],
        });

        render(<Main />);

        const avatar = screen.getByRole('img');
        expect(avatar).toHaveAttribute('src', 'https://example.com/bot.png');
        expect(avatar).toHaveAttribute('alt', 'Pomocnik');
      });

      it('should show avatar fallback letter for notice messages without avatar', () => {
        setupMocks({
          messages: [
            createMessage({
              id: '1',
              message: 'Channel notice',
              nick: 'Pomocnik',
              category: MessageCategory.notice,
              color: MessageColor.notice,
            }),
          ],
        });

        render(<Main />);

        expect(screen.getByText('P')).toBeInTheDocument();
      });

      it('should mark consecutive notice messages from the same nick as grouped', () => {
        setupMocks({
          messages: [
            createMessage({
              id: '1',
              message: 'First notice',
              nick: createUserNick({ nick: 'NickServ' }),
              category: MessageCategory.notice,
              color: MessageColor.notice,
            }),
            createMessage({
              id: '2',
              message: 'Second notice',
              nick: createUserNick({ nick: 'NickServ' }),
              category: MessageCategory.notice,
              color: MessageColor.notice,
              time: '2024-01-01T12:00:01Z',
            }),
          ],
        });

        const { container } = render(<Main />);

        const messages = getMessages(container);
        expect(messages[0]).not.toHaveAttribute('data-grouped');
        expect(messages[1]).toHaveAttribute('data-grouped');
      });

      it('should show bot indicator for notice from bot', () => {
        setupMocks({
          messages: [
            createMessage({
              id: '1',
              message: 'Bot notice',
              nick: createUserNick({ nick: 'Pomocnik', bot: true }),
              category: MessageCategory.notice,
              color: MessageColor.notice,
            }),
          ],
        });

        const { container } = render(<Main />);

        expect(getHeaderNick(container)?.textContent).toBe('Pomocnik');
        expect(container.querySelector('.sic-msg-header svg.lucide-bot')).toBeInTheDocument();
      });

      it('should render notice without nick when nick is not set', () => {
        setupMocks({
          messages: [
            createMessage({
              id: '1',
              message: 'Server notice without nick',
              category: MessageCategory.notice,
              color: MessageColor.notice,
            }),
          ],
        });

        const { container } = render(<Main />);

        expect(container.textContent).toContain('Server notice without nick');
      });
    });

    describe('/me messages (MessageCategory.me)', () => {
      it('should show avatar for /me messages', () => {
        setupMocks({
          messages: [
            createMessage({
              id: '1',
              message: 'waves hello',
              nick: createUserNick({ nick: 'ActionUser', avatar: 'https://example.com/avatar.png' }),
              category: MessageCategory.me,
              color: MessageColor.me,
            }),
          ],
        });

        render(<Main />);

        const avatar = screen.getByRole('img');
        expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.png');
        expect(avatar).toHaveAttribute('alt', 'ActionUser');
      });

      it('should show nick for /me messages', () => {
        setupMocks({
          messages: [
            createMessage({
              id: '1',
              message: 'waves hello',
              nick: 'ActionUser',
              category: MessageCategory.me,
              color: MessageColor.me,
            }),
          ],
        });

        const { container } = render(<Main />);

        expect(getHeaderNick(container)?.textContent).toBe('ActionUser');
      });

      it('should show avatar fallback letter for /me messages without avatar', () => {
        setupMocks({
          messages: [
            createMessage({
              id: '1',
              message: 'waves hello',
              nick: 'ActionUser',
              category: MessageCategory.me,
              color: MessageColor.me,
            }),
          ],
        });

        render(<Main />);

        expect(screen.getByText('A')).toBeInTheDocument();
      });

      it('should apply /me message color', () => {
        setupMocks({
          messages: [
            createMessage({
              id: '1',
              message: 'waves hello',
              nick: 'ActionUser',
              category: MessageCategory.me,
              color: MessageColor.me,
            }),
          ],
        });

        const { container } = render(<Main />);

        expect(container.textContent).toContain('waves hello');
        expect(getBody(container)).toHaveStyle({ color: MessageColor.me });
      });

      it('should mark consecutive /me messages from same user as grouped', () => {
        setupMocks({
          messages: [
            createMessage({
              id: '1',
              message: 'waves hello',
              nick: 'ActionUser',
              category: MessageCategory.me,
              color: MessageColor.me,
            }),
            createMessage({
              id: '2',
              message: 'dances around',
              nick: 'ActionUser',
              category: MessageCategory.me,
              color: MessageColor.me,
            }),
          ],
        });

        const { container } = render(<Main />);

        expect(getMessages(container)[1]).toHaveAttribute('data-grouped');
      });

      it('should group /me messages with regular messages from same user', () => {
        setupMocks({
          messages: [
            createMessage({
              id: '1',
              message: 'Hello everyone',
              nick: 'TestUser',
              category: MessageCategory.default,
            }),
            createMessage({
              id: '2',
              message: 'waves hello',
              nick: 'TestUser',
              category: MessageCategory.me,
              color: MessageColor.me,
            }),
          ],
        });

        const { container } = render(<Main />);

        expect(getMessages(container)[1]).toHaveAttribute('data-grouped');
      });

      it('should not mark /me message from a different user as grouped', () => {
        setupMocks({
          messages: [
            createMessage({
              id: '1',
              message: 'Hello',
              nick: 'User1',
              category: MessageCategory.default,
            }),
            createMessage({
              id: '2',
              message: 'waves at everyone',
              nick: 'User2',
              category: MessageCategory.me,
              color: MessageColor.me,
            }),
          ],
        });

        const { container } = render(<Main />);

        expect(getMessages(container)[1]).not.toHaveAttribute('data-grouped');
      });

      it('should trigger context menu on right-click on nick in /me message', () => {
        setupMocks({
          messages: [
            createMessage({
              id: '1',
              message: 'waves hello',
              nick: 'ActionUser',
              category: MessageCategory.me,
              color: MessageColor.me,
            }),
          ],
        });

        const { container } = render(<Main />);

        const nickElement = getHeaderNick(container);
        expect(nickElement).not.toBeNull();
        if (nickElement) fireEvent.contextMenu(nickElement);

        expect(mockHandleContextMenuUserClick).toHaveBeenCalledWith(
          expect.any(Object),
          'user',
          'ActionUser'
        );
      });

      it('should trigger context menu on right-click on avatar in /me message', () => {
        setupMocks({
          messages: [
            createMessage({
              id: '1',
              message: 'waves hello',
              nick: createUserNick({ nick: 'ActionUser', avatar: 'https://example.com/avatar.png' }),
              category: MessageCategory.me,
              color: MessageColor.me,
            }),
          ],
        });

        render(<Main />);

        const avatarContainer = screen.getByRole('img').parentElement;
        expect(avatarContainer).not.toBeNull();
        if (avatarContainer) fireEvent.contextMenu(avatarContainer);

        expect(mockHandleContextMenuUserClick).toHaveBeenCalledWith(
          expect.any(Object),
          'user',
          'ActionUser'
        );
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty nick string', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Test', nick: '' })],
      });

      const { container } = render(<Main />);

      expect(container.textContent).toContain('Test');
    });

    it('should handle undefined nick', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'No nick message', nick: undefined })],
      });

      const { container } = render(<Main />);

      expect(container.textContent).toContain('No nick message');
    });

    it('should use the debug DOM only for debug/status channels', () => {
      setupMocks({
        currentChannelName: '#regular',
        messages: [createMessage({ id: '1', time: '2024-01-01T12:34:56Z' })],
      });

      const { container } = render(<Main />);

      expect(container.querySelector('.sic-msg')).not.toHaveAttribute('data-debug');
    });
  });

  describe('Message grouping (data-grouped)', () => {
    it('should mark consecutive messages from the same user as grouped', () => {
      setupMocks({
        messages: [
          createMessage({ id: '1', message: 'First', nick: 'User1' }),
          createMessage({ id: '2', message: 'Second', nick: 'User1' }),
        ],
      });

      const { container } = render(<Main />);

      const messages = getMessages(container);
      expect(messages[0]).not.toHaveAttribute('data-grouped');
      expect(messages[1]).toHaveAttribute('data-grouped');
    });

    it('should not mark messages from a different user as grouped', () => {
      setupMocks({
        messages: [
          createMessage({ id: '1', message: 'User1 msg', nick: 'User1' }),
          createMessage({ id: '2', message: 'User2 msg', nick: 'User2' }),
        ],
      });

      const { container } = render(<Main />);

      const messages = getMessages(container);
      expect(messages[1]).not.toHaveAttribute('data-grouped');
    });

    it('should not mark a message as grouped after a non-content message in between', () => {
      setupMocks({
        messages: [
          createMessage({ id: '1', message: 'Hello', nick: 'User1' }),
          createMessage({ id: '2', message: 'User2 joined', nick: 'User2', category: MessageCategory.join }),
          createMessage({ id: '3', message: 'Hello again', nick: 'User1' }),
        ],
      });

      const { container } = render(<Main />);

      const messages = getMessages(container);
      expect(messages[2]).not.toHaveAttribute('data-grouped');
    });

    it('should handle mixed string and User object nicks for grouping', () => {
      setupMocks({
        messages: [
          createMessage({ id: '1', message: 'First', nick: 'TestUser' }),
          createMessage({ id: '2', message: 'Second', nick: createUserNick({ nick: 'TestUser' }) }),
        ],
      });

      const { container } = render(<Main />);

      expect(getMessages(container)[1]).toHaveAttribute('data-grouped');
    });

    it('should still render avatar and header slots for grouped messages (hidden by theme CSS)', () => {
      setupMocks({
        messages: [
          createMessage({ id: '1', message: 'First', nick: createUserNick({ nick: 'User1', avatar: 'https://example.com/a.png' }) }),
          createMessage({ id: '2', message: 'Second', nick: createUserNick({ nick: 'User1', avatar: 'https://example.com/a.png' }) }),
        ],
      });

      render(<Main />);

      // The superset DOM keeps the avatar/header in grouped messages so custom
      // themes can opt out of grouping purely via CSS
      expect(screen.getAllByRole('img')).toHaveLength(2);
    });
  });

  describe('Nick context menu', () => {
    it('should trigger context menu on right-click on the inline nick', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Hello', nick: 'TestUser' })],
      });

      const { container } = render(<Main />);

      const nickElement = getInlineNick(container);
      expect(nickElement).not.toBeNull();
      if (nickElement) fireEvent.contextMenu(nickElement);

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

      const { container } = render(<Main />);

      const nickElement = getInlineNick(container);
      expect(nickElement).not.toBeNull();
      if (nickElement) fireEvent.contextMenu(nickElement);

      expect(mockHandleContextMenuUserClick).toHaveBeenCalledWith(
        expect.any(Object),
        'user',
        'DebugUser'
      );
    });

    it('should trigger context menu on right-click on the header nick', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Hello', nick: 'ModernUser' })],
      });

      const { container } = render(<Main />);

      const nickElement = getHeaderNick(container);
      expect(nickElement).not.toBeNull();
      if (nickElement) fireEvent.contextMenu(nickElement);

      expect(mockHandleContextMenuUserClick).toHaveBeenCalledWith(
        expect.any(Object),
        'user',
        'ModernUser'
      );
    });

    it('should trigger context menu on right-click on avatar', () => {
      setupMocks({
        messages: [
          createMessage({
            id: '1',
            message: 'Hello',
            nick: createUserNick({ nick: 'AvatarUser', avatar: 'https://example.com/avatar.png' }),
          }),
        ],
      });

      render(<Main />);

      const avatarContainer = screen.getByRole('img').parentElement;
      expect(avatarContainer).not.toBeNull();
      if (avatarContainer) fireEvent.contextMenu(avatarContainer);

      expect(mockHandleContextMenuUserClick).toHaveBeenCalledWith(
        expect.any(Object),
        'user',
        'AvatarUser'
      );
    });

    it('should have cursor-pointer class on clickable nick elements', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Hello', nick: 'TestUser' })],
      });

      const { container } = render(<Main />);

      expect(getInlineNick(container)).toHaveClass('cursor-pointer');
      expect(getHeaderNick(container)).toHaveClass('cursor-pointer');
    });

    it('should have hover:underline class on clickable nick elements', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Hello', nick: 'TestUser' })],
      });

      const { container } = render(<Main />);

      expect(getInlineNick(container)).toHaveClass('hover:underline');
      expect(getHeaderNick(container)).toHaveClass('hover:underline');
    });

    it('should handle User object nick for context menu', () => {
      setupMocks({
        messages: [
          createMessage({
            id: '1',
            message: 'Hello',
            nick: createUserNick({ nick: 'ObjectUser', color: '#ff0000' }),
          }),
        ],
      });

      const { container } = render(<Main />);

      const nickElement = getHeaderNick(container);
      expect(nickElement).not.toBeNull();
      if (nickElement) fireEvent.contextMenu(nickElement);

      expect(mockHandleContextMenuUserClick).toHaveBeenCalledWith(
        expect.any(Object),
        'user',
        'ObjectUser'
      );
    });

    it.each([
      ['join', MessageCategory.join, MessageColor.join, 'JoinUser joined the channel', 'JoinUser'],
      ['part', MessageCategory.part, MessageColor.part, 'PartUser left the channel', 'PartUser'],
      ['quit', MessageCategory.quit, MessageColor.quit, 'QuitUser quit', 'QuitUser'],
      ['kick', MessageCategory.kick, MessageColor.kick, 'KickUser was kicked', 'KickUser'],
    ])('should trigger context menu on right-click on %s message nick', (_name, category, color, text, nick) => {
      setupMocks({
        messages: [createMessage({ id: '1', message: text, nick, category, color })],
      });

      const { container } = render(<Main />);

      const messageElement = container.querySelector('.sic-msg-body .cursor-pointer');
      expect(messageElement).not.toBeNull();
      if (messageElement) fireEvent.contextMenu(messageElement);

      expect(mockHandleContextMenuUserClick).toHaveBeenCalledWith(
        expect.any(Object),
        'user',
        nick
      );
    });

    it('should trigger context menu on right-click on join message in debug view', () => {
      setupMocks({
        currentChannelName: DEBUG_CHANNEL,
        messages: [createMessage({ id: '1', message: 'JoinUser joined', nick: 'JoinUser', category: MessageCategory.join, color: MessageColor.join })],
      });

      const { container } = render(<Main />);

      const clickableSpan = container.querySelector('span.cursor-pointer');
      expect(clickableSpan).not.toBeNull();
      if (clickableSpan) fireEvent.contextMenu(clickableSpan);

      expect(mockHandleContextMenuUserClick).toHaveBeenCalledWith(
        expect.any(Object),
        'user',
        'JoinUser'
      );
    });

    it('should not render an inline nick element for join messages', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'JoinUser joined', nick: 'JoinUser', category: MessageCategory.join, color: MessageColor.join })],
      });

      const { container } = render(<Main />);

      expect(getInlineNick(container)).not.toBeInTheDocument();
      expect(container.textContent).toContain('JoinUser joined');
    });

    it('should not have cursor-pointer on join message without nick', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'System join message', category: MessageCategory.join, color: MessageColor.join })],
      });

      const { container } = render(<Main />);

      const joinMsg = container.querySelector('.sic-msg[data-category="join"]');
      expect(joinMsg).not.toBeNull();
      expect(joinMsg?.querySelector('.cursor-pointer')).toBeNull();
    });
  });

  describe('Scroll behavior on channel change', () => {
    it('should scroll to bottom synchronously on channel change', () => {
      setupMocks({ currentChannelName: '#channel1', messages: [createMessage({ id: '1' })] });

      const { container, rerender } = render(<Main />);
      const scrollContainer = container.firstChild as HTMLDivElement;

      // Simulate scroll container dimensions
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 400, configurable: true });

      // User scrolls up in channel1
      scrollContainer.scrollTop = 200;
      fireEvent.scroll(scrollContainer);

      // Change channel
      setupMocks({ currentChannelName: '#channel2', messages: [createMessage({ id: '2' })] });
      rerender(<Main />);

      // Should scroll to bottom immediately (no RAF needed)
      expect(scrollContainer.scrollTop).toBe(scrollContainer.scrollHeight);
    });

    it('should reset isUserScrolledUp flag when channel changes', () => {
      setupMocks({ currentChannelName: '#channel1', messages: [createMessage({ id: '1' })] });

      const { container, rerender } = render(<Main />);
      const scrollContainer = container.firstChild as HTMLDivElement;

      // Simulate scroll container dimensions
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 400, configurable: true });

      // User scrolls up significantly (more than 50px from bottom)
      scrollContainer.scrollTop = 200; // distanceFromBottom = 1000 - 200 - 400 = 400 > 50
      fireEvent.scroll(scrollContainer);

      // Change channel
      setupMocks({ currentChannelName: '#channel2', messages: [createMessage({ id: '2' })] });
      rerender(<Main />);

      // Trigger ResizeObserver (simulating content update)
      resizeObserverCallback([], {} as ResizeObserver);

      // Should scroll to bottom because isUserScrolledUp was reset
      expect(scrollContainer.scrollTop).toBe(scrollContainer.scrollHeight);
    });

    it('should not be affected by scroll events triggered during programmatic scroll', () => {
      setupMocks({ currentChannelName: '#channel1', messages: [createMessage({ id: '1' })] });

      const { container, rerender } = render(<Main />);
      const scrollContainer = container.firstChild as HTMLDivElement;

      // Simulate scroll container dimensions
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 400, configurable: true });

      // Change channel
      setupMocks({ currentChannelName: '#channel2', messages: [createMessage({ id: '2' })] });
      rerender(<Main />);

      // Simulate scroll event that would normally be triggered by scrollTop assignment
      scrollContainer.scrollTop = scrollContainer.scrollHeight;

      // ResizeObserver should still scroll to bottom
      resizeObserverCallback([], {} as ResizeObserver);

      expect(scrollContainer.scrollTop).toBe(scrollContainer.scrollHeight);
    });

    it('should scroll to bottom on initial channel load via ResizeObserver', () => {
      setupMocks({ currentChannelName: '#channel1', messages: [createMessage({ id: '1' })] });

      const { container } = render(<Main />);
      const scrollContainer = container.firstChild as HTMLDivElement;

      // After initial render, content loads and ResizeObserver fires
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 500, configurable: true });
      resizeObserverCallback([], {} as ResizeObserver);

      expect(scrollContainer.scrollTop).toBe(scrollContainer.scrollHeight);
    });
  });

  describe('Echo message indicator', () => {
    it('should display echoed indicator in the header and trailing time slots when echoed=true', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Echoed message', nick: 'TestUser', echoed: true })],
      });

      const { container } = render(<Main />);

      expect(container.querySelector('.sic-msg-time-header svg.lucide-check-check')).toBeInTheDocument();
      expect(container.querySelector('.sic-msg-time-trailing svg.lucide-check-check')).toBeInTheDocument();
      // The inline (classic) time slot never shows the indicator
      expect(container.querySelector('.sic-msg-time-inline svg.lucide-check-check')).not.toBeInTheDocument();
    });

    it('should not display echoed indicator when message has echoed=false', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Not echoed message', nick: 'TestUser', echoed: false })],
      });

      const { container } = render(<Main />);

      const checkIcon = container.querySelector('svg.lucide-check-check');
      expect(checkIcon).not.toBeInTheDocument();
    });

    it('should not display echoed indicator when echoed is undefined', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Regular message', nick: 'TestUser' })],
      });

      const { container } = render(<Main />);

      const checkIcon = container.querySelector('svg.lucide-check-check');
      expect(checkIcon).not.toBeInTheDocument();
    });

    it('should display echoed indicator for grouped messages (same user)', () => {
      setupMocks({
        messages: [
          createMessage({ id: '1', message: 'First message', nick: 'TestUser', echoed: true }),
          createMessage({ id: '2', message: 'Second message', nick: 'TestUser', echoed: true }),
        ],
      });

      const { container } = render(<Main />);

      // Each message renders the indicator in the trailing slot (shown for grouped rows)
      const trailingIcons = container.querySelectorAll('.sic-msg-time-trailing svg.lucide-check-check');
      expect(trailingIcons.length).toBe(2);
    });

    it('should display echoed indicator only for echoed messages in mixed list', () => {
      setupMocks({
        messages: [
          createMessage({ id: '1', message: 'Echoed message', nick: 'User1', echoed: true }),
          createMessage({ id: '2', message: 'Not echoed message', nick: 'User2', echoed: false }),
          createMessage({ id: '3', message: 'Another echoed message', nick: 'User3', echoed: true }),
        ],
      });

      const { container } = render(<Main />);

      const messagesWithIcon = getMessages(container).filter((m) => m.querySelector('svg.lucide-check-check'));
      expect(messagesWithIcon.length).toBe(2);
    });

    it('should not render echoed indicator in debug view', () => {
      setupMocks({
        currentChannelName: DEBUG_CHANNEL,
        messages: [createMessage({ id: '1', message: 'Echoed message', nick: 'TestUser', echoed: true })],
      });

      const { container } = render(<Main />);

      const checkIcon = container.querySelector('svg.lucide-check-check');
      expect(checkIcon).not.toBeInTheDocument();
    });

    it('should have tooltip trigger on echoed indicator', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Echoed message', nick: 'TestUser', echoed: true })],
      });

      const { container } = render(<Main />);

      // Tooltip trigger wraps the icon
      const triggerButton = container.querySelector('[data-state]');
      expect(triggerButton).toBeInTheDocument();
    });

    it('should display echoed indicator with correct styling', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Echoed message', nick: 'TestUser', echoed: true })],
      });

      const { container } = render(<Main />);

      const checkIcon = container.querySelector('svg.lucide-check-check');
      expect(checkIcon).toHaveClass('h-3', 'w-3', 'inline-block', 'ml-1');
    });
  });

  describe('Bot indicator', () => {
    it('should display bot indicator in the header when nick is a bot user', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Hello', nick: createUserNick({ nick: 'BotUser', bot: true }) })],
      });

      const { container } = render(<Main />);

      expect(container.querySelector('.sic-msg-header svg.lucide-bot')).toBeInTheDocument();
    });

    it('should display bot indicator next to the inline nick when nick is a bot user', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Hello', nick: createUserNick({ nick: 'BotUser', bot: true }) })],
      });

      const { container } = render(<Main />);

      expect(container.querySelector('.sic-msg-bot-inline svg.lucide-bot')).toBeInTheDocument();
    });

    it('should not display bot indicator when nick is not a bot', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Hello', nick: createUserNick({ nick: 'RegularUser' }) })],
      });

      const { container } = render(<Main />);

      const botIcon = container.querySelector('svg.lucide-bot');
      expect(botIcon).not.toBeInTheDocument();
    });

    it('should not display bot indicator when nick is a string', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Hello', nick: 'StringNick' })],
      });

      const { container } = render(<Main />);

      const botIcon = container.querySelector('svg.lucide-bot');
      expect(botIcon).not.toBeInTheDocument();
    });

    it('should not display bot indicator when bot is false', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Hello', nick: createUserNick({ nick: 'NotBot', bot: false }) })],
      });

      const { container } = render(<Main />);

      const botIcon = container.querySelector('svg.lucide-bot');
      expect(botIcon).not.toBeInTheDocument();
    });

    it('should not display bot indicator in debug view', () => {
      setupMocks({
        currentChannelName: DEBUG_CHANNEL,
        messages: [createMessage({ id: '1', message: 'Hello', nick: createUserNick({ nick: 'BotUser', bot: true }) })],
      });

      const { container } = render(<Main />);

      const botIcon = container.querySelector('svg.lucide-bot');
      expect(botIcon).not.toBeInTheDocument();
    });

    it('should display bot indicator with correct styling', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Hello', nick: createUserNick({ nick: 'BotUser', bot: true }) })],
      });

      const { container } = render(<Main />);

      const botIcon = container.querySelector('svg.lucide-bot');
      expect(botIcon).toHaveClass('h-4', 'w-4', 'inline-block', 'ml-1', 'text-orange-400');
    });

    it('should display bot indicator only for bot messages in mixed list', () => {
      setupMocks({
        messages: [
          createMessage({ id: '1', message: 'Bot msg', nick: createUserNick({ nick: 'Bot1', bot: true }) }),
          createMessage({ id: '2', message: 'Human msg', nick: createUserNick({ nick: 'Human' }) }),
          createMessage({ id: '3', message: 'Bot msg 2', nick: createUserNick({ nick: 'Bot2', bot: true }) }),
        ],
      });

      const { container } = render(<Main />);

      const messagesWithBot = getMessages(container).filter((m) => m.querySelector('svg.lucide-bot'));
      expect(messagesWithBot).toHaveLength(2);
    });
  });

  describe('Scroll behavior with content resize', () => {
    it('should set up ResizeObserver on mount', () => {
      setupMocks({ messages: [createMessage({ id: '1' })] });

      const { container } = render(<Main />);
      const scrollContainer = container.firstChild as HTMLDivElement;
      const content = scrollContainer.lastElementChild;

      // ResizeObserver should observe the content element
      expect(content).toBeTruthy();
      // Callback should be set (ResizeObserver was instantiated)
      expect(resizeObserverCallback).toBeDefined();
    });

    it('should scroll to bottom when content resizes and user has not scrolled up', () => {
      setupMocks({ messages: [createMessage({ id: '1' })] });

      const { container } = render(<Main />);
      const scrollContainer = container.firstChild as HTMLDivElement;

      // Simulate content height increase (e.g., image loaded)
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, configurable: true });
      scrollContainer.scrollTop = 500;

      // Trigger ResizeObserver callback
      resizeObserverCallback([], {} as ResizeObserver);

      expect(scrollContainer.scrollTop).toBe(scrollContainer.scrollHeight);
    });

    it('should not scroll to bottom when content resizes and user has scrolled up', () => {
      setupMocks({ messages: [createMessage({ id: '1' })] });

      const { container } = render(<Main />);
      const scrollContainer = container.firstChild as HTMLDivElement;

      // Simulate scroll container dimensions
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 400, configurable: true });

      // User scrolls up (more than 50px from bottom)
      scrollContainer.scrollTop = 400; // distanceFromBottom = 1000 - 400 - 400 = 200 > 50
      fireEvent.scroll(scrollContainer);

      const scrollTopBeforeResize = scrollContainer.scrollTop;

      // Trigger ResizeObserver callback (simulating image load)
      resizeObserverCallback([], {} as ResizeObserver);

      // Should NOT scroll to bottom since user scrolled up
      expect(scrollContainer.scrollTop).toBe(scrollTopBeforeResize);
    });

    it('should disconnect ResizeObserver on unmount', () => {
      setupMocks({ messages: [createMessage({ id: '1' })] });

      const { unmount } = render(<Main />);

      unmount();

      expect(mockResizeObserverDisconnect).toHaveBeenCalled();
    });

    it('should reset scroll position when changing channels', () => {
      setupMocks({ messages: [createMessage({ id: '1' })] });

      const { container, rerender } = render(<Main />);
      const scrollContainer = container.firstChild as HTMLDivElement;

      // Simulate scroll container dimensions
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 400, configurable: true });

      // User scrolls up
      scrollContainer.scrollTop = 400;
      fireEvent.scroll(scrollContainer);

      // Change channel
      setupMocks({ currentChannelName: '#other', messages: [createMessage({ id: '2' })] });
      rerender(<Main />);

      // Trigger ResizeObserver callback (simulating images loading in new channel)
      resizeObserverCallback([], {} as ResizeObserver);

      // Should scroll to bottom since channel changed resets isUserScrolledUp
      expect(scrollContainer.scrollTop).toBe(scrollContainer.scrollHeight);
    });
  });

  describe('Display name support', () => {
    it('should display displayName instead of nick when available', () => {
      setupMocks({
        messages: [
          createMessage({
            id: '1',
            message: 'Hello world',
            nick: createUserNick({ nick: 'john', displayName: 'John Doe' }),
          }),
        ],
      });

      const { container } = render(<Main />);

      expect(getHeaderNick(container)?.textContent).toBe('John Doe');
      expect(getInlineNick(container)?.textContent).toBe('John Doe');
      expect(screen.queryByText('john')).not.toBeInTheDocument();
    });

    it('should display displayName in debug view', () => {
      setupMocks({
        currentChannelName: DEBUG_CHANNEL,
        messages: [
          createMessage({
            id: '1',
            message: 'Debug message',
            nick: createUserNick({ nick: 'john', displayName: 'John Doe' }),
          }),
        ],
      });

      const { container } = render(<Main />);

      expect(getInlineNick(container)?.textContent).toBe('John Doe');
    });

    it('should use displayName for avatar fallback letter', () => {
      setupMocks({
        messages: [
          createMessage({
            id: '1',
            message: 'Hello world',
            nick: createUserNick({ nick: 'john', displayName: 'John Doe' }),
          }),
        ],
      });

      render(<Main />);

      // Avatar fallback letter should be 'J' from 'John Doe', not 'j' from 'john'
      expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('should fall back to nick when displayName is not set', () => {
      setupMocks({
        messages: [
          createMessage({
            id: '1',
            message: 'Hello world',
            nick: createUserNick({ nick: 'john' }),
          }),
        ],
      });

      const { container } = render(<Main />);

      expect(getHeaderNick(container)?.textContent).toBe('john');
    });

    it('should fall back to nick when displayName is empty string', () => {
      setupMocks({
        messages: [
          createMessage({
            id: '1',
            message: 'Hello world',
            nick: createUserNick({ nick: 'john', displayName: '' }),
          }),
        ],
      });

      const { container } = render(<Main />);

      expect(getHeaderNick(container)?.textContent).toBe('john');
    });

    it('should still use nick for context menu even when displayName is shown', () => {
      setupMocks({
        messages: [
          createMessage({
            id: '1',
            message: 'Hello world',
            nick: createUserNick({ nick: 'john', displayName: 'John Doe' }),
          }),
        ],
      });

      const { container } = render(<Main />);

      const nickElement = getHeaderNick(container);
      expect(nickElement).not.toBeNull();
      if (nickElement) fireEvent.contextMenu(nickElement);

      // Context menu should receive the actual nick, not displayName
      expect(mockHandleContextMenuUserClick).toHaveBeenCalledWith(
        expect.any(Object),
        'user',
        'john'
      );
    });

    it('should group messages by nick, not by displayName', () => {
      setupMocks({
        messages: [
          createMessage({
            id: '1',
            message: 'First message',
            nick: createUserNick({ nick: 'john', displayName: 'John Doe' }),
          }),
          createMessage({
            id: '2',
            message: 'Second message',
            nick: createUserNick({ nick: 'john', displayName: 'John Doe' }),
          }),
        ],
      });

      const { container } = render(<Main />);

      expect(getMessages(container)[1]).toHaveAttribute('data-grouped');
    });
  });

  describe('Highlight styling', () => {
    it('should mark highlighted messages with data-highlight', () => {
      setupMocks({
        messages: [
          createMessage({ id: '1', message: 'Hey you!', nick: 'SomeUser', highlight: true }),
        ],
      });

      const { container } = render(<Main />);

      expect(container.querySelector('.sic-msg')).toHaveAttribute('data-highlight');
    });

    it('should not mark non-highlighted messages with data-highlight', () => {
      setupMocks({
        messages: [
          createMessage({ id: '1', message: 'Normal message', nick: 'SomeUser', highlight: false }),
        ],
      });

      const { container } = render(<Main />);

      expect(container.querySelector('.sic-msg')).not.toHaveAttribute('data-highlight');
    });
  });

  describe('Not connected empty state', () => {
    it('should show NotConnected component and DisconnectedBanner when disconnected and no messages', () => {
      setupMocks({ isConnected: false, messages: [] });

      const { container } = render(<Main />);

      // Both NotConnected and DisconnectedBanner render
      const statusElements = screen.getAllByRole('status');
      expect(statusElements).toHaveLength(2);
      expect(container.querySelectorAll('svg.lucide-wifi-off')).toHaveLength(2);
    });

    it('should not show NotConnected or DisconnectedBanner when connected', () => {
      setupMocks({ isConnected: true, messages: [] });

      render(<Main />);

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('should show DisconnectedBanner without NotConnected when disconnected but has messages', () => {
      setupMocks({
        isConnected: false,
        messages: [createMessage({ id: '1', message: 'Old message' })],
      });

      const { container } = render(<Main />);

      // Only DisconnectedBanner should show (single status element)
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(container.querySelectorAll('svg.lucide-wifi-off')).toHaveLength(1);
      expect(container.textContent).toContain('Old message');
    });
  });

  describe('Chat context menu', () => {
    it('should open text context menu when right-clicking with text selected', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Hello world', nick: 'TestUser' })],
      });

      const { container } = render(<Main />);
      const scrollContainer = container.firstChild as HTMLDivElement;

      // Mock globalThis.getSelection to return selected text
      const mockGetSelection = vi.spyOn(globalThis, 'getSelection').mockReturnValue({
        toString: () => 'Hello',
      } as Selection);

      fireEvent.contextMenu(scrollContainer);

      expect(mockHandleContextMenuUserClick).toHaveBeenCalledWith(
        expect.any(Object),
        'text',
        'Hello'
      );

      mockGetSelection.mockRestore();
    });

    it('should open chat context menu when right-clicking on empty space without selection', () => {
      setupMocks({
        currentChannelName: '#mychannel',
        messages: [createMessage({ id: '1', message: 'Hello world', nick: 'TestUser' })],
      });

      const { container } = render(<Main />);
      const scrollContainer = container.firstChild as HTMLDivElement;

      // Mock globalThis.getSelection to return empty selection
      const mockGetSelection = vi.spyOn(globalThis, 'getSelection').mockReturnValue({
        toString: () => '',
      } as Selection);

      fireEvent.contextMenu(scrollContainer);

      expect(mockHandleContextMenuUserClick).toHaveBeenCalledWith(
        expect.any(Object),
        'chat',
        '#mychannel'
      );

      mockGetSelection.mockRestore();
    });

    it('should not open chat/text context menu when nick context menu already handled', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Hello', nick: 'TestUser' })],
      });

      const { container } = render(<Main />);

      // Right-click on nick triggers the nick handler which calls preventDefault
      const nickElement = getHeaderNick(container);
      expect(nickElement).not.toBeNull();
      if (nickElement) fireEvent.contextMenu(nickElement);

      // Should be called once (for user context menu from nick click)
      expect(mockHandleContextMenuUserClick).toHaveBeenCalledTimes(1);
      expect(mockHandleContextMenuUserClick).toHaveBeenCalledWith(
        expect.any(Object),
        'user',
        'TestUser'
      );
    });

    it('should preventDefault and stopPropagation when showing text context menu', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Hello world', nick: 'TestUser' })],
      });

      const { container } = render(<Main />);
      const scrollContainer = container.firstChild as HTMLDivElement;

      const mockGetSelection = vi.spyOn(globalThis, 'getSelection').mockReturnValue({
        toString: () => 'selected',
      } as Selection);

      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

      scrollContainer.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(stopPropagationSpy).toHaveBeenCalled();

      mockGetSelection.mockRestore();
    });

    it('should preventDefault and stopPropagation when showing chat context menu', () => {
      setupMocks({
        messages: [createMessage({ id: '1', message: 'Hello world', nick: 'TestUser' })],
      });

      const { container } = render(<Main />);
      const scrollContainer = container.firstChild as HTMLDivElement;

      const mockGetSelection = vi.spyOn(globalThis, 'getSelection').mockReturnValue({
        toString: () => '',
      } as Selection);

      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
      const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

      scrollContainer.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(stopPropagationSpy).toHaveBeenCalled();

      mockGetSelection.mockRestore();
    });
  });

  describe('Date separator', () => {
    const getDateSeparators = (container: HTMLElement) =>
      container.querySelectorAll('[role="separator"]');

    it('should show date separator between messages on different days', () => {
      setupMocks({
        messages: [
          createMessage({ id: '1', message: 'Yesterday msg', nick: createUserNick({ nick: 'User1' }), time: '2024-01-01T12:00:00Z' }),
          createMessage({ id: '2', message: 'Today msg', nick: createUserNick({ nick: 'User1' }), time: '2024-01-02T12:00:00Z' }),
        ],
      });

      const { container } = render(<Main />);

      expect(getDateSeparators(container).length).toBe(1);
    });

    it('should not show date separator between messages on the same day', () => {
      setupMocks({
        messages: [
          createMessage({ id: '1', message: 'Morning msg', nick: createUserNick({ nick: 'User1' }), time: '2024-01-01T08:00:00Z' }),
          createMessage({ id: '2', message: 'Afternoon msg', nick: createUserNick({ nick: 'User1' }), time: '2024-01-01T14:00:00Z' }),
        ],
      });

      const { container } = render(<Main />);

      expect(getDateSeparators(container).length).toBe(0);
    });

    it('should reset nick grouping after date separator', () => {
      setupMocks({
        messages: [
          createMessage({ id: '1', message: 'Before midnight', nick: createUserNick({ nick: 'User1', avatar: 'https://example.com/a.png' }), time: '2024-01-01T12:00:00Z' }),
          createMessage({ id: '2', message: 'After midnight', nick: createUserNick({ nick: 'User1', avatar: 'https://example.com/a.png' }), time: '2024-01-02T12:00:00Z' }),
        ],
      });

      const { container } = render(<Main />);

      const messages = getMessages(container);
      expect(messages[0]).not.toHaveAttribute('data-grouped');
      expect(messages[1]).not.toHaveAttribute('data-grouped');
    });

    it('should still group consecutive messages from same user without date change', () => {
      setupMocks({
        messages: [
          createMessage({ id: '1', message: 'First', nick: createUserNick({ nick: 'User1', avatar: 'https://example.com/a.png' }), time: '2024-01-01T12:00:00Z' }),
          createMessage({ id: '2', message: 'Second', nick: createUserNick({ nick: 'User1', avatar: 'https://example.com/a.png' }), time: '2024-01-01T12:01:00Z' }),
          createMessage({ id: '3', message: 'After midnight', nick: createUserNick({ nick: 'User1', avatar: 'https://example.com/a.png' }), time: '2024-01-02T12:00:00Z' }),
          createMessage({ id: '4', message: 'After midnight 2', nick: createUserNick({ nick: 'User1', avatar: 'https://example.com/a.png' }), time: '2024-01-02T12:01:00Z' }),
        ],
      });

      const { container } = render(<Main />);

      const grouped = container.querySelectorAll('.sic-msg[data-grouped]');
      expect(grouped.length).toBe(2);
    });

    it('should reset nick grouping after date separator with different users', () => {
      setupMocks({
        messages: [
          createMessage({ id: '1', message: 'User1 day1', nick: createUserNick({ nick: 'User1', avatar: 'https://example.com/a.png' }), time: '2024-01-01T12:00:00Z' }),
          createMessage({ id: '2', message: 'User2 day2', nick: createUserNick({ nick: 'User2', avatar: 'https://example.com/b.png' }), time: '2024-01-02T12:00:00Z' }),
        ],
      });

      const { container } = render(<Main />);

      expect(container.querySelectorAll('.sic-msg[data-grouped]').length).toBe(0);

      // Date separator should be present
      expect(getDateSeparators(container).length).toBe(1);
    });
  });
});
