import { describe, expect, it, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import i18next from 'i18next';
import Main from '@features/chat/components/Chat';
import * as settingsStore from '@features/settings/store/settings';
import * as currentStore from '@features/chat/store/current';
import * as ContextMenuContext from '@/providers/ContextMenuContext';
import * as chatHistoryFile from '@/network/irc/chatHistory';
import { MessageCategory, type Message, type User } from '@shared/types';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { markCapabilitiesAcknowledged, resetCapabilityState } from '@/network/irc/capabilities';
import { clearAllReplies, getReplyTo } from '@features/replies/store/replyTo';
import { useGoToMessageStore } from '@features/chat/store/goToMessage';
import { E2eeState, getSessionKey, useE2eeStore, type E2eeSession } from '@features/e2ee/store/e2ee';
import { useUsersStore } from '@features/users/store/users';
import * as network from '@/network/irc/network';

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
const getLog = (container: HTMLElement) => container.querySelector<HTMLDivElement>('[data-testid="chat-log"]') as HTMLDivElement;
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

    vi.spyOn(ContextMenuContext, 'useContextMenuActions').mockReturnValue({
      handleContextMenuUserClick: mockHandleContextMenuUserClick,
      handleContextMenuClose: mockHandleContextMenuClose,
    });

    // Default channel types mock
    vi.spyOn(settingsStore, 'getChannelTypes').mockReturnValue(['#']);
  });

  const setupMocks = (overrides: {
    currentChannelName?: string;
    theme?: string;
    messages?: Message[];
    isConnected?: boolean;
    clientTagDeny?: string[];
    membershipEvents?: settingsStore.SettingsStore['membershipEvents'];
    density?: settingsStore.Density;
    timeFormat?: settingsStore.TimeFormat;
    showSeconds?: boolean;
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
        clientTagDeny: overrides.clientTagDeny ?? [],
        nick: 'me',
        membershipEvents: overrides.membershipEvents ?? 'collapse',
        caseMapping: 'rfc1459',
        density: overrides.density ?? 'comfortable',
        timeFormat: overrides.timeFormat ?? '24h',
        showSeconds: overrides.showSeconds ?? false,
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
      const scrollContainer = getLog(container);

      // scrollTop should be set to scrollHeight (scroll to bottom)
      expect(scrollContainer.scrollTop).toBe(scrollContainer.scrollHeight);
    });
  });

  describe('Layout settings for themes', () => {
    it('should tell themes the spacing the user chose', () => {
      setupMocks({ density: 'compact' });

      render(<Main />);

      expect(screen.getByTestId('chat-log')).toHaveAttribute('data-density', 'compact');
    });

    it('should tell themes how wide the time is', () => {
      setupMocks();
      const { unmount } = render(<Main />);
      expect(screen.getByTestId('chat-log').style.getPropertyValue('--sic-time-width')).toBe('5ch');
      unmount();

      setupMocks({ timeFormat: '12h', showSeconds: true });
      render(<Main />);
      expect(screen.getByTestId('chat-log').style.getPropertyValue('--sic-time-width')).toBe('11ch');
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

  describe('Membership events', () => {
    const joins = (): Message[] => [
      createMessage({ id: 'say', nick: 'alice', message: 'hi all' }),
      createMessage({ id: 'j1', nick: 'bob', message: 'bob has joined', category: MessageCategory.join }),
      createMessage({ id: 'j2', nick: 'carol', message: 'carol has joined', category: MessageCategory.join }),
      createMessage({ id: 'n1', message: 'dave has changed his nickname to dave_', category: MessageCategory.info, renamed: { from: 'dave', to: 'dave_' } }),
    ];

    it('should show events in a row as one line that lists who did what', () => {
      setupMocks({ messages: joins() });

      const { container } = render(<Main />);

      const toggle = screen.getByRole('button', { expanded: false });
      expect(toggle).toHaveTextContent('Weszli: bob, carol · Zmienili nick: dave → dave_');
      expect(container.querySelector('.sic-msg[data-category="events"]')).not.toBeNull();
      expect(container.textContent).not.toContain('bob has joined');
      // The run's wrapper carries its last event's id, which older history cannot change
      expect(container.querySelector('[data-message-id="n1"] .sic-msg[data-category="events"]')).not.toBeNull();
    });

    it('should show and hide the events themselves', () => {
      setupMocks({ messages: joins() });

      const { container } = render(<Main />);
      fireEvent.click(screen.getByRole('button', { expanded: false }));

      expect(screen.getByRole('button', { expanded: true })).toBeInTheDocument();
      expect(container.textContent).toContain('bob has joined');
      expect(container.textContent).toContain('carol has joined');

      fireEvent.click(screen.getByRole('button', { expanded: true }));
      expect(container.textContent).not.toContain('bob has joined');
    });

    it('should show every event line with "all"', () => {
      setupMocks({ messages: joins(), membershipEvents: 'all' });

      const { container } = render(<Main />);

      expect(container.querySelector('.sic-msg[data-category="events"]')).toBeNull();
      expect(getMessages(container)).toHaveLength(4);
    });

    it.each([STATUS_CHANNEL, DEBUG_CHANNEL])('should not collapse in %s', (channel) => {
      setupMocks({ currentChannelName: channel, messages: joins() });

      const { container } = render(<Main />);

      expect(container.querySelector('.sic-msg[data-category="events"]')).toBeNull();
    });

    it('should not group a message after a run with the one before it', () => {
      setupMocks({ messages: [...joins(), createMessage({ id: 'again', nick: 'alice', message: 'still here' })] });

      const { container } = render(<Main />);

      expect(container.querySelector('[data-message-id="again"] .sic-msg')).not.toHaveAttribute('data-grouped');
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

    it('should not mark a message as grouped after more than 5 minutes of silence', () => {
      setupMocks({
        messages: [
          createMessage({ id: '1', message: 'Hello', nick: 'User1', time: '2024-01-01T12:00:00Z' }),
          createMessage({ id: '2', message: 'Back again', nick: 'User1', time: '2024-01-01T12:05:01Z' }),
          createMessage({ id: '3', message: 'Still here', nick: 'User1', time: '2024-01-01T12:06:00Z' }),
        ],
      });

      const { container } = render(<Main />);

      const messages = getMessages(container);
      expect(messages[1]).not.toHaveAttribute('data-grouped');
      expect(messages[2]).toHaveAttribute('data-grouped');
    });

    it('should mark a message as grouped exactly 5 minutes after the previous one', () => {
      setupMocks({
        messages: [
          createMessage({ id: '1', message: 'Hello', nick: 'User1', time: '2024-01-01T12:00:00Z' }),
          createMessage({ id: '2', message: 'Same thought', nick: 'User1', time: '2024-01-01T12:05:00Z' }),
        ],
      });

      const { container } = render(<Main />);

      expect(getMessages(container)[1]).toHaveAttribute('data-grouped');
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

  describe('Loading older history', () => {
    const scrollUpTo = (scrollContainer: HTMLDivElement, scrollTop: number): void => {
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 400, configurable: true });
      scrollContainer.scrollTop = 600;
      fireEvent.scroll(scrollContainer);
      scrollContainer.scrollTop = scrollTop;
      fireEvent.scroll(scrollContainer);
    };

    it('should ask for older messages when the user scrolls up near the top', () => {
      const requestOlderHistory = vi.spyOn(chatHistoryFile, 'requestOlderHistory').mockImplementation(() => true);
      setupMocks({ currentChannelName: '#channel1', messages: [createMessage({ id: '1' })] });
      const { container } = render(<Main />);

      scrollUpTo(getLog(container), 150);

      expect(requestOlderHistory).toHaveBeenCalledWith('#channel1');
    });

    it('should not ask while the user reads further down', () => {
      const requestOlderHistory = vi.spyOn(chatHistoryFile, 'requestOlderHistory').mockImplementation(() => true);
      setupMocks({ messages: [createMessage({ id: '1' })] });
      const { container } = render(<Main />);

      scrollUpTo(getLog(container), 300);

      expect(requestOlderHistory).not.toHaveBeenCalled();
    });

    it('should keep what the user reads in place when older messages go in above it', () => {
      vi.spyOn(chatHistoryFile, 'requestOlderHistory').mockImplementation(() => true);
      const tops: Record<string, number> = { '2': 10, '3': 60 };
      vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
        return { top: tops[this.closest<HTMLElement>('[data-message-id]')?.dataset.messageId ?? ''] ?? 0 } as DOMRect;
      });
      const shown = [createMessage({ id: '2' }), createMessage({ id: '3' })];
      setupMocks({ messages: shown });
      const { container, rerender } = render(<Main />);
      const scrollContainer = getLog(container);
      scrollUpTo(scrollContainer, 100);

      tops['2'] = 310;
      setupMocks({ messages: [createMessage({ id: '1', time: '2024-01-01T11:00:00Z' }), ...shown] });
      rerender(<Main />);

      expect(scrollContainer.scrollTop).toBe(400);
    });
  });

  describe('Scroll behavior on channel change', () => {
    it('should scroll to bottom synchronously on channel change', () => {
      setupMocks({ currentChannelName: '#channel1', messages: [createMessage({ id: '1' })] });

      const { container, rerender } = render(<Main />);
      const scrollContainer = getLog(container);

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
      const scrollContainer = getLog(container);

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
      const scrollContainer = getLog(container);

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
      const scrollContainer = getLog(container);

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

  describe('Jump to the newest messages', () => {
    const jumpButton = () => screen.queryByRole('button', { name: i18next.t('main.chat.jumpToBottom') });

    const scrollTo = (log: HTMLDivElement, scrollTop: number): void => {
      Object.defineProperty(log, 'scrollHeight', { value: 2000, configurable: true });
      Object.defineProperty(log, 'clientHeight', { value: 400, configurable: true });
      log.scrollTop = 1600;
      fireEvent.scroll(log);
      log.scrollTop = scrollTop;
      fireEvent.scroll(log);
    };

    it('should not offer it at the bottom, nor less than a screen above it', () => {
      setupMocks({ messages: [createMessage({ id: '1' })] });
      const { container } = render(<Main />);
      expect(jumpButton()).not.toBeInTheDocument();

      scrollTo(getLog(container), 1300);

      expect(jumpButton()).not.toBeInTheDocument();
    });

    it('should offer it more than a screen above the bottom, and hide it back down there', () => {
      setupMocks({ messages: [createMessage({ id: '1' })] });
      const { container } = render(<Main />);
      const log = getLog(container);

      scrollTo(log, 1000);
      expect(jumpButton()).toBeInTheDocument();

      log.scrollTop = 1600;
      fireEvent.scroll(log);
      expect(jumpButton()).not.toBeInTheDocument();
    });

    it('should offer it once new messages push the bottom more than a screen away', () => {
      setupMocks({ messages: [createMessage({ id: '1' })] });
      const { container, rerender } = render(<Main />);
      const log = getLog(container);
      scrollTo(log, 1300);
      expect(jumpButton()).not.toBeInTheDocument();

      Object.defineProperty(log, 'scrollHeight', { value: 2500, configurable: true });
      setupMocks({ messages: [createMessage({ id: '1' }), createMessage({ id: '2' })] });
      rerender(<Main />);

      expect(jumpButton()).toBeInTheDocument();
    });

    it('should scroll to the bottom when clicked, and follow new messages again', () => {
      setupMocks({ messages: [createMessage({ id: '1' })] });
      const { container } = render(<Main />);
      const log = getLog(container);
      log.scrollTo = vi.fn();
      scrollTo(log, 200);

      fireEvent.click(jumpButton() as HTMLElement);

      expect(log.scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 2000, behavior: 'smooth' });
      log.scrollTop = 200;
      act(() => {
        resizeObserverCallback([], {} as ResizeObserver);
      });
      expect(log.scrollTop).toBe(2000);
    });
  });

  describe('Scroll behavior with content resize', () => {
    it('should set up ResizeObserver on mount', () => {
      setupMocks({ messages: [createMessage({ id: '1' })] });

      const { container } = render(<Main />);
      const scrollContainer = getLog(container);
      const content = scrollContainer.lastElementChild;

      // ResizeObserver should observe the content element
      expect(content).toBeTruthy();
      // Callback should be set (ResizeObserver was instantiated)
      expect(resizeObserverCallback).toBeDefined();
    });

    it('should scroll to bottom when content resizes and user has not scrolled up', () => {
      setupMocks({ messages: [createMessage({ id: '1' })] });

      const { container } = render(<Main />);
      const scrollContainer = getLog(container);

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
      const scrollContainer = getLog(container);

      // Simulate scroll container dimensions
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 400, configurable: true });

      // User scrolls up from the bottom (more than 50px from bottom)
      scrollContainer.scrollTop = 600;
      fireEvent.scroll(scrollContainer);
      scrollContainer.scrollTop = 400; // distanceFromBottom = 1000 - 400 - 400 = 200 > 50
      fireEvent.scroll(scrollContainer);

      const scrollTopBeforeResize = scrollContainer.scrollTop;

      // Trigger ResizeObserver callback (simulating image load)
      resizeObserverCallback([], {} as ResizeObserver);

      // Should NOT scroll to bottom since user scrolled up
      expect(scrollContainer.scrollTop).toBe(scrollTopBeforeResize);
    });

    it('should keep scrolling to bottom after a scroll anchoring adjustment', () => {
      setupMocks({ messages: [createMessage({ id: '1' })] });

      const { container } = render(<Main />);
      const scrollContainer = getLog(container);

      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1000, configurable: true });
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 400, configurable: true });
      scrollContainer.scrollTop = 600;
      fireEvent.scroll(scrollContainer);

      // Content grows (theme change, images); the browser shifts the view down with it, short of the new bottom
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 1500, configurable: true });
      scrollContainer.scrollTop = 900; // distanceFromBottom = 1500 - 900 - 400 = 200 > 50
      fireEvent.scroll(scrollContainer);

      resizeObserverCallback([], {} as ResizeObserver);

      expect(scrollContainer.scrollTop).toBe(scrollContainer.scrollHeight);
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
      const scrollContainer = getLog(container);

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
      const scrollContainer = getLog(container);

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
      const scrollContainer = getLog(container);

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
      const scrollContainer = getLog(container);

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
      const scrollContainer = getLog(container);

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

  describe('Reactions', () => {
    const getAddReaction = (container: HTMLElement) => container.querySelector('.sic-msg-actions .sic-msg-react');

    beforeEach(() => {
      markCapabilitiesAcknowledged(['message-tags']);
    });

    afterEach(() => {
      resetCapabilityState();
    });

    it('offers to react to a message the server gave a msgid', () => {
      setupMocks({ messages: [createMessage({ id: 'm1', msgid: 'm1' })] });

      const { container } = render(<Main />);

      expect(getAddReaction(container)).toBeInTheDocument();
      // Focusable, for a tap to show the actions on touch screens
      expect(getMessages(container)[0]).toHaveAttribute('tabindex', '-1');
    });

    it.each([
      ['a message without a msgid', { messages: [createMessage({ id: 'local' })] }],
      ['while disconnected', { messages: [createMessage({ id: 'm1', msgid: 'm1' })], isConnected: false }],
      ['when the server drops reactions', { messages: [createMessage({ id: 'm1', msgid: 'm1' })], clientTagDeny: ['draft/react'] }],
    ])('does not offer to react to %s', (_case, mocks) => {
      setupMocks(mocks);

      const { container } = render(<Main />);

      expect(getAddReaction(container)).not.toBeInTheDocument();
    });

    it('shows the reactions under the message', () => {
      setupMocks({ messages: [createMessage({ id: 'm1', msgid: 'm1', reactions: [{ emoji: '👍', nicks: ['alice', 'bob'] }] })] });

      const { container } = render(<Main />);

      const reaction = container.querySelector('.sic-msg-content .sic-msg-reactions .sic-reaction');
      expect(reaction).toHaveTextContent('👍2');
      expect(reaction).toBeEnabled();
    });

    it('shows reactions it cannot add to while disconnected', () => {
      setupMocks({ messages: [createMessage({ id: 'm1', msgid: 'm1', reactions: [{ emoji: '👍', nicks: ['alice'] }] })], isConnected: false });

      const { container } = render(<Main />);

      expect(container.querySelector('.sic-reaction')).toBeDisabled();
    });
  });

  describe('Deleting messages', () => {
    const getDeleteButton = (container: HTMLElement) => container.querySelector('.sic-msg-actions .sic-msg-delete-action');
    const ownMessage = createMessage({ id: 'local', msgid: 'm1', nick: 'me', message: 'oops' });
    const theirMessage = createMessage({ id: 'local', msgid: 'm1', nick: 'alice', message: 'spam' });
    const asMember = (flags: string[]) => useUsersStore.setState({
      users: [{ nick: 'me', ident: '', hostname: '', flags: [], channels: [{ name: '#test', flags, maxPermission: -1 }] } as unknown as User],
    });

    beforeEach(() => {
      markCapabilitiesAcknowledged(['message-tags', 'draft/message-redaction']);
      asMember([]);
    });

    afterEach(() => {
      resetCapabilityState();
      useUsersStore.setState({ users: [] });
    });

    it('deletes the user\'s own message once confirmed', () => {
      const send = vi.spyOn(network, 'ircSendCommand').mockImplementation(() => true);
      setupMocks({ messages: [ownMessage] });

      const { container } = render(<Main />);
      fireEvent.click(getDeleteButton(container) as Element);
      expect(screen.getByTestId('redact-dialog')).toHaveTextContent('oops');
      expect(send).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('redact-confirm'));

      expect(send).toHaveBeenCalledExactlyOnceWith('REDACT #test m1', { window: '#test' });
      expect(screen.queryByTestId('redact-dialog')).not.toBeInTheDocument();
    });

    it('sends nothing when the deletion is cancelled', () => {
      const send = vi.spyOn(network, 'ircSendCommand').mockImplementation(() => true);
      setupMocks({ messages: [ownMessage] });

      const { container } = render(<Main />);
      fireEvent.click(getDeleteButton(container) as Element);
      fireEvent.keyDown(screen.getByTestId('redact-dialog'), { key: 'Escape' });

      expect(screen.queryByTestId('redact-dialog')).not.toBeInTheDocument();
      expect(send).not.toHaveBeenCalled();
    });

    it('lets a channel operator delete anyone\'s message', () => {
      asMember(['o']);
      setupMocks({ messages: [theirMessage] });

      const { container } = render(<Main />);

      expect(getDeleteButton(container)).toBeInTheDocument();
    });

    it.each([
      ['someone else\'s message, to a voiced user', ['v'], { messages: [theirMessage] }],
      ['without the capability', [], { messages: [ownMessage] }, true],
      ['a message without a msgid', [], { messages: [{ ...ownMessage, msgid: undefined }] }],
      ['an encrypted message', [], { messages: [{ ...ownMessage, e2ee: 'ok' as const }] }],
      ['a notice', [], { messages: [{ ...ownMessage, category: MessageCategory.notice }] }],
      ['in Status', [], { messages: [{ ...ownMessage, target: STATUS_CHANNEL }], currentChannelName: STATUS_CHANNEL }],
    ])('does not offer to delete %s', (_case, flags, mocks, withoutCapability = false) => {
      if (withoutCapability) {
        resetCapabilityState();
      }
      asMember(flags);
      setupMocks(mocks);

      const { container } = render(<Main />);

      expect(getDeleteButton(container)).not.toBeInTheDocument();
    });

    it('shows a deleted message as one, without its text, actions or previews', () => {
      setupMocks({ messages: [{ ...ownMessage, message: '', redacted: true }] });

      const { container } = render(<Main />);

      const row = getMessages(container)[0];
      expect(row).toHaveAttribute('data-redacted');
      expect(row?.querySelector('.sic-msg-body .sic-msg-redacted')).toBeInTheDocument();
      expect(row?.querySelector('.sic-msg-actions')).not.toBeInTheDocument();
      expect(row?.querySelector('.sic-msg-embeds')).not.toBeInTheDocument();
    });

    it('shows a reply to a deleted message as answering a deleted one', () => {
      setupMocks({
        messages: [
          { ...theirMessage, message: '', redacted: true },
          createMessage({ id: 'r1', msgid: 'r1', nick: 'bob', replyTo: 'm1', message: 'lol' }),
        ],
      });

      const { container } = render(<Main />);

      expect(container.querySelector('.sic-msg-reply-text')?.textContent).not.toBe('');
      expect(container.querySelector('.sic-msg-reply-text')?.textContent).toBe(getMessages(container)[0]?.querySelector('.sic-msg-redacted')?.textContent);
    });
  });

  describe('Replies', () => {
    const getReplyButton = (container: HTMLElement) => container.querySelector('.sic-msg-actions .sic-msg-reply-action');

    beforeEach(() => {
      clearAllReplies();
      useE2eeStore.setState({ sessions: {} });
    });

    it('offers to reply, on a server without message tags too', () => {
      const message = createMessage({ id: 'local', nick: 'alice' });
      setupMocks({ messages: [message] });

      const { container } = render(<Main />);
      fireEvent.click(getReplyButton(container) as Element);

      expect(getReplyTo('#test')).toBe(message);
      expect(getMessages(container)[0]).toHaveAttribute('tabindex', '-1');
    });

    it.each([
      ['while disconnected', { messages: [createMessage({ id: '1' })], isConnected: false }],
      ['to a notice', { messages: [createMessage({ id: '1', category: MessageCategory.notice })] }],
      ['to a system message', { messages: [createMessage({ id: '1', system: true })] }],
      ['to an encrypted message', { messages: [createMessage({ id: '1', e2ee: 'ok' })] }],
      ['in Status', { messages: [createMessage({ id: '1', target: STATUS_CHANNEL })], currentChannelName: STATUS_CHANNEL }],
    ])('does not offer to reply %s', (_case, mocks) => {
      setupMocks(mocks);

      const { container } = render(<Main />);

      expect(getReplyButton(container)).not.toBeInTheDocument();
      expect(getMessages(container)[0]).not.toHaveAttribute('tabindex');
    });

    it('does not offer to reply in an encrypted conversation', () => {
      useE2eeStore.setState({ sessions: { [getSessionKey('bob')]: { state: E2eeState.active } as E2eeSession } });
      setupMocks({ messages: [createMessage({ id: '1', target: 'bob' })], currentChannelName: 'bob' });

      const { container } = render(<Main />);

      expect(getReplyButton(container)).not.toBeInTheDocument();
    });

    it('shows what a reply answers above it, with its own header', () => {
      setupMocks({
        messages: [
          createMessage({ id: 'm1', msgid: 'm1', nick: createUserNick({ nick: 'alice' }), message: 'the \x02question\x02' }),
          createMessage({ id: 'm2', msgid: 'm2', nick: createUserNick({ nick: 'alice' }), message: 'the answer', replyTo: 'm1' }),
        ],
      });

      const { container } = render(<Main />);

      const reply = getMessages(container)[1];
      expect(reply?.querySelector('.sic-msg-content > .sic-msg-reply')).toHaveTextContent('alicethe question');
      expect(reply).not.toHaveAttribute('data-grouped');
      expect(reply).toHaveAttribute('data-reply');
      expect(getMessages(container)[0]).not.toHaveAttribute('data-reply');
    });

    it('says when the message replied to is not shown', () => {
      setupMocks({ messages: [createMessage({ id: 'm2', msgid: 'm2', message: 'the answer', replyTo: 'gone' })] });

      const { container } = render(<Main />);

      expect(container.querySelector('.sic-msg-reply .sic-msg-reply-text')).toBeInTheDocument();
      expect(container.querySelector('.sic-msg-reply .sic-msg-reply-nick')).not.toBeInTheDocument();
    });

    it('goes to the message replied to, and marks it a moment', () => {
      vi.useFakeTimers();
      setupMocks({
        messages: [
          createMessage({ id: 'm1', msgid: 'm1', message: 'the question' }),
          createMessage({ id: 'm2', msgid: 'm2', message: 'the answer', replyTo: 'm1' }),
        ],
      });
      const { container } = render(<Main />);
      const original = getMessages(container)[0] as HTMLElement;
      vi.mocked(Element.prototype.scrollIntoView).mockClear();

      fireEvent.click(container.querySelector('.sic-msg-reply') as Element);

      expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts).toEqual([original]);
      expect(original).toHaveAttribute('data-shown');
      vi.advanceTimersByTime(2000);
      expect(original).not.toHaveAttribute('data-shown');
      vi.useRealTimers();
    });

    it('pages back through history for a message not shown, and goes to it once it is', () => {
      const requestOlderHistory = vi.spyOn(chatHistoryFile, 'requestOlderHistory').mockImplementation(() => true);
      const reply = createMessage({ id: 'm2', msgid: 'm2', message: 'the answer', replyTo: 'm1', time: '2024-01-01T12:05:00Z' });
      setupMocks({ messages: [reply] });
      const { container, rerender } = render(<Main />);

      fireEvent.click(container.querySelector('.sic-msg-reply') as Element);
      expect(requestOlderHistory).toHaveBeenCalledExactlyOnceWith('#test');

      // A page without it: on to the next
      const older = createMessage({ id: 'm0', msgid: 'm0', message: 'older', time: '2024-01-01T12:00:00Z' });
      setupMocks({ messages: [older, reply] });
      rerender(<Main />);
      expect(requestOlderHistory).toHaveBeenCalledTimes(2);

      vi.mocked(Element.prototype.scrollIntoView).mockClear();
      setupMocks({ messages: [older, createMessage({ id: 'm1', msgid: 'm1', message: 'the question', time: '2024-01-01T12:01:00Z' }), reply] });
      rerender(<Main />);

      expect(requestOlderHistory).toHaveBeenCalledTimes(2);
      expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts).toEqual([getMessages(container)[1]]);
    });

    it('stops looking once history has no more', () => {
      const requestOlderHistory = vi.spyOn(chatHistoryFile, 'requestOlderHistory').mockImplementation(() => false);
      const reply = createMessage({ id: 'm2', msgid: 'm2', message: 'the answer', replyTo: 'm1' });
      setupMocks({ messages: [reply] });
      const { container, rerender } = render(<Main />);

      fireEvent.click(container.querySelector('.sic-msg-reply') as Element);
      setupMocks({ messages: [reply, createMessage({ id: 'm3', message: 'later' })] });
      rerender(<Main />);

      expect(requestOlderHistory).toHaveBeenCalledTimes(1);
    });

    it('shows a line written as a quote as one, without its marker', () => {
      setupMocks({ messages: [createMessage({ id: '1', message: '> <alice> the question' })] });

      const { container } = render(<Main />);

      expect(getMessages(container)[0]).toHaveAttribute('data-quote');
      expect(getBody(container)).toHaveTextContent(/^<alice> the question$/);
    });

    it('shows the quoted lines of a multiline message as quotes, the other lines as they are', () => {
      setupMocks({ messages: [createMessage({ id: '1', message: '> <alice> the question\n> and more\nthe answer' })] });

      const { container } = render(<Main />);

      expect(getMessages(container)[0]).not.toHaveAttribute('data-quote');
      const quotes = container.querySelectorAll('.sic-msg-body .sic-msg-quote');
      expect(quotes).toHaveLength(1);
      expect(quotes[0]?.textContent).toBe('<alice> the question\nand more');
      expect(getBody(container)?.textContent).toBe('<alice> the question\nand more\nthe answer');
    });

    it('does not quote a multiline message without quoted lines', () => {
      setupMocks({ messages: [createMessage({ id: '1', message: 'one\n>two' })] });

      const { container } = render(<Main />);

      expect(container.querySelector('.sic-msg-quote')).not.toBeInTheDocument();
      expect(getBody(container)?.textContent).toBe('one\n>two');
    });

    it('does not quote lines of a notice from the server', () => {
      setupMocks({ messages: [createMessage({ id: '1', message: '> one\n> two', category: MessageCategory.info })] });

      const { container } = render(<Main />);

      expect(container.querySelector('.sic-msg-quote')).not.toBeInTheDocument();
    });
  });

  describe('Going to a message', () => {
    const messages = [createMessage({ id: 'm1', message: 'found it' }), createMessage({ id: 'm2', message: 'later' })];

    afterEach(() => {
      useGoToMessageStore.setState({ sought: undefined });
    });

    it('goes to the message once its window shows, and marks it a moment', () => {
      vi.useFakeTimers();
      setupMocks({ messages });
      const { container } = render(<Main />);
      vi.mocked(Element.prototype.scrollIntoView).mockClear();

      act(() => {
        useGoToMessageStore.setState({ sought: { channelName: '#TEST', messageId: 'm1' } });
      });

      const found = getMessages(container)[0];
      expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts).toEqual([found]);
      expect(found).toHaveAttribute('data-shown');
      expect(useGoToMessageStore.getState().sought).toBeUndefined();
      vi.advanceTimersByTime(2000);
      expect(found).not.toHaveAttribute('data-shown');
      vi.useRealTimers();
    });

    it('keeps the view on the message as new ones arrive', () => {
      setupMocks({ messages });
      const { container, rerender } = render(<Main />);
      const log = getLog(container);
      Object.defineProperty(log, 'scrollHeight', { configurable: true, value: 2000 });
      Object.defineProperty(log, 'clientHeight', { configurable: true, value: 500 });
      // Where scrolling to the message lands, far above the bottom
      vi.mocked(Element.prototype.scrollIntoView).mockImplementation(() => { log.scrollTop = 600; });

      act(() => {
        useGoToMessageStore.setState({ sought: { channelName: '#test', messageId: 'm1' } });
      });
      setupMocks({ messages: [...messages, createMessage({ id: 'm3', message: 'newer' })] });
      rerender(<Main />);
      act(() => {
        resizeObserverCallback([], {} as ResizeObserver);
      });

      expect(log.scrollTop).toBe(600);
      vi.mocked(Element.prototype.scrollIntoView).mockReset();
    });

    it('waits while another window shows', () => {
      useGoToMessageStore.setState({ sought: { channelName: '#other', messageId: 'm1' } });
      setupMocks({ messages });

      render(<Main />);

      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
      expect(useGoToMessageStore.getState().sought).toEqual({ channelName: '#other', messageId: 'm1' });
    });

    it('stops looking for a message the window no longer holds', () => {
      useGoToMessageStore.setState({ sought: { channelName: '#test', messageId: 'dropped' } });
      setupMocks({ messages });

      const { container } = render(<Main />);

      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
      expect(container.querySelector('[data-shown]')).not.toBeInTheDocument();
      expect(useGoToMessageStore.getState().sought).toBeUndefined();
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
