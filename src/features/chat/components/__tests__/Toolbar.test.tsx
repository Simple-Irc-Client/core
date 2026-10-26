import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Toolbar from '../Toolbar';
import * as settingsStore from '@features/settings/store/settings';
import * as networksStore from '@features/networks/store/networks';
import * as network from '@/network/irc/network';
import * as users from '@features/users/store/users';
import * as channelList from '@features/channels/store/channelList';
import * as capabilities from '@/network/irc/capabilities';
import * as ownMessages from '@features/chat/ownMessages';
import { act } from '@testing-library/react';
import { ChannelCategory, type Message, MessageCategory } from '@shared/types';
import { clearAllReplies, getReplyTo, setReplyTo } from '@features/replies/store/replyTo';
import { E2eeState, getSessionKey, useE2eeStore, type E2eeSession } from '@features/e2ee/store/e2ee';
import { useShortcutsStore } from '@features/shortcuts/store/shortcuts';
import { mockStoreState, setTestSession, setTestSlice } from '@/test/networks';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));

vi.mock('@/network/irc/network', () => ({
  ircSendRawMessage: vi.fn(),
  ircSendCommand: vi.fn(),
  getMaxIrcMessageLength: () => 510,
  ircReconnect: vi.fn(),
}));

const mockResetAndGoToStart = vi.fn();
const mockChangeServer = vi.fn();
vi.mock('@features/networks/networkLifecycle', () => ({
  resetAndGoToStart: () => mockResetAndGoToStart(),
  changeServer: () => mockChangeServer(),
}));

const mockSetAddMessage = vi.fn();
vi.mock('@features/channels/store/channels', () => ({
  setAddMessage: (...args: unknown[]) => mockSetAddMessage(...args),
}));

vi.mock('@/network/irc/capabilities', () => ({
  isCapabilityEnabled: vi.fn(),
  getCapabilityValue: vi.fn(),
}));

let mockAwayMessages: unknown[] = [];

vi.mock('@features/channels/store/awayMessages', () => ({
  useActiveAwayMessages: (selector: (state: { messages: unknown[] }) => unknown) => selector({ messages: mockAwayMessages }),
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid',
}));

vi.mock('emoji-picker-react', () => ({
  default: ({ onEmojiClick, colorScheme }: { onEmojiClick: (data: { emoji: string }) => void; colorScheme?: string }) => (
    <div data-testid="emoji-picker" data-color-scheme={colorScheme}>
      <button type="button" onClick={() => onEmojiClick({ emoji: '😀' })} data-testid="emoji-grinning">
        😀
      </button>
      <button type="button" onClick={() => onEmojiClick({ emoji: '❤️' })} data-testid="emoji-heart">
        ❤️
      </button>
    </div>
  ),
}));

describe('Toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAwayMessages = [];
    mockSetAddMessage.mockClear();
    vi.spyOn(capabilities, 'isCapabilityEnabled').mockReturnValue(false);

    // Mock globalThis.matchMedia for EmojiPicker's autoFocusSearch prop
    Object.defineProperty(globalThis, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    mockStoreState({
        currentChannelName: '#test',
        currentChannelCategory: ChannelCategory.channel,
        nick: 'testUser',
        currentUserFlags: [],
        isConnected: true,
        isAutoAway: false,
        fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        setFontFormatting: vi.fn(),
      });

    vi.spyOn(networksStore, 'getCurrentNick').mockReturnValue('testUser');

    vi.spyOn(users, 'useActiveUsers').mockImplementation((selector) =>
      selector({ users: [] })
    );
    vi.spyOn(users, 'getUser').mockReturnValue(undefined);

    vi.spyOn(channelList, 'getChannelListSortedByAZ').mockReturnValue([]);
  });

  describe('Basic rendering', () => {
    it('should render the input field', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('should show send button when message is not empty', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hello' } });

      const sendButton = screen.getByRole('button', { name: 'main.toolbar.send' });
      expect(sendButton).toBeInTheDocument();
    });

    it('should not show send button when message is empty', () => {
      render(<Toolbar />);

      const sendButton = screen.queryByRole('button', { name: 'main.toolbar.send' });
      expect(sendButton).not.toBeInTheDocument();
    });
  });

  describe('Message submission', () => {
    it('should send PRIVMSG when submitting a regular message', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hello world' } });

      const form = input.closest('form');
      expect(form).not.toBeNull();
      fireEvent.submit(form as HTMLFormElement);

      expect(network.ircSendCommand).toHaveBeenCalledWith('PRIVMSG #test :Hello world', { window: '#test' });
    });

    it('should clear input after submission', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hello world' } });

      const form = input.closest('form');
      fireEvent.submit(form as HTMLFormElement);

      expect(input).toHaveValue('');
    });

    it('should send ||text|| as a spoiler', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'the end: ||he dies||' } });
      fireEvent.submit(input.closest('form') as HTMLFormElement);

      expect(network.ircSendCommand).toHaveBeenCalledWith('PRIVMSG #test :the end: \x0314,14he dies\x03', { window: '#test' });
    });

    it('should go back to the chosen color after a spoiler', () => {
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: [],
          isConnected: true,
          isAutoAway: false,
          fontFormatting: { colorCode: 4, bold: false, italic: false, underline: false },
          setFontFormatting: vi.fn(),
        });
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '||a|| b' } });
      fireEvent.submit(input.closest('form') as HTMLFormElement);

      expect(network.ircSendCommand).toHaveBeenCalledWith('PRIVMSG #test :\x0304\x0314,14a\x0304,99 b\x03', { window: '#test' });
    });

    it('should not touch || in a command', () => {
      vi.spyOn(ownMessages, 'showOwnCommandMessages').mockImplementation(() => {});
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '/me ||x||' } });
      fireEvent.submit(input.closest('form') as HTMLFormElement);

      expect(network.ircSendCommand).toHaveBeenCalledWith('PRIVMSG #test :\x01ACTION ||x||\x01', { window: '#test' });
    });

    it('should not send message when input is empty', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      const form = input.closest('form');
      fireEvent.submit(form as HTMLFormElement);

      expect(network.ircSendCommand).not.toHaveBeenCalledWith(expect.stringContaining('PRIVMSG'), expect.anything());
    });
  });

  describe('Message history', () => {
    it('should navigate to previous message with ArrowUp', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');

      // Send first message
      fireEvent.change(input, { target: { value: 'First message' } });
      const form = input.closest('form');
      fireEvent.submit(form as HTMLFormElement);

      // Press ArrowUp to get the previous message
      fireEvent.keyDown(input, { key: 'ArrowUp' });

      expect(input).toHaveValue('First message');
    });

    it('should navigate through multiple history messages', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      const form = input.closest('form');

      // Send messages
      fireEvent.change(input, { target: { value: 'First message' } });
      fireEvent.submit(form as HTMLFormElement);

      fireEvent.change(input, { target: { value: 'Second message' } });
      fireEvent.submit(form as HTMLFormElement);

      fireEvent.change(input, { target: { value: 'Third message' } });
      fireEvent.submit(form as HTMLFormElement);

      // Navigate up through history (most recent first)
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input).toHaveValue('Third message');

      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input).toHaveValue('Second message');

      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input).toHaveValue('First message');
    });

    it('should navigate back with ArrowDown', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      const form = input.closest('form');

      // Send messages
      fireEvent.change(input, { target: { value: 'First message' } });
      fireEvent.submit(form as HTMLFormElement);

      fireEvent.change(input, { target: { value: 'Second message' } });
      fireEvent.submit(form as HTMLFormElement);

      // Navigate up
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input).toHaveValue('First message');

      // Navigate down
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(input).toHaveValue('Second message');

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(input).toHaveValue('');
    });

    it('should preserve current input when navigating history', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      const form = input.closest('form');

      // Send a message to history
      fireEvent.change(input, { target: { value: 'History message' } });
      fireEvent.submit(form as HTMLFormElement);

      // Type something new
      fireEvent.change(input, { target: { value: 'Current typing' } });

      // Navigate up to history
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input).toHaveValue('History message');

      // Navigate back down should restore current input
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(input).toHaveValue('Current typing');
    });

    it('should not navigate when history is empty', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Current text' } });

      fireEvent.keyDown(input, { key: 'ArrowUp' });

      expect(input).toHaveValue('Current text');
    });

    it('should not go beyond oldest message', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      const form = input.closest('form');

      // Send one message
      fireEvent.change(input, { target: { value: 'Only message' } });
      fireEvent.submit(form as HTMLFormElement);

      // Try to go up multiple times
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      fireEvent.keyDown(input, { key: 'ArrowUp' });

      expect(input).toHaveValue('Only message');
    });

    it('should limit history to 10 messages', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      const form = input.closest('form');

      // Send 12 messages
      for (let i = 1; i <= 12; i++) {
        fireEvent.change(input, { target: { value: `Message ${i}` } });
        fireEvent.submit(form as HTMLFormElement);
      }

      // Navigate through all history
      for (let i = 0; i < 15; i++) {
        fireEvent.keyDown(input, { key: 'ArrowUp' });
      }

      // Should stop at the 10th oldest (Message 3, since 1 and 2 were dropped)
      expect(input).toHaveValue('Message 3');
    });

    it('should reset history index after sending new message', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      const form = input.closest('form');

      // Send first message
      fireEvent.change(input, { target: { value: 'First message' } });
      fireEvent.submit(form as HTMLFormElement);

      // Navigate to it
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input).toHaveValue('First message');

      // Send another message
      fireEvent.change(input, { target: { value: 'Second message' } });
      fireEvent.submit(form as HTMLFormElement);

      // ArrowUp should now show the newest message
      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input).toHaveValue('Second message');
    });
  });

  describe('DEBUG_CHANNEL handling', () => {
    it('should not render input for DEBUG_CHANNEL', () => {
      mockStoreState({
          currentChannelName: 'Debug',
          currentChannelCategory: ChannelCategory.status,
          nick: 'testUser',
          currentUserFlags: [],
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      render(<Toolbar />);

      const input = screen.queryByRole('textbox');
      expect(input).not.toBeInTheDocument();
    });
  });

  describe('Emoji picker', () => {
    it('should render the emoticons button', () => {
      render(<Toolbar />);

      const emoticonButton = screen.getByRole('button', { name: 'main.toolbar.emoticons' });
      expect(emoticonButton).toBeInTheDocument();
    });

    it('should open emoji picker when clicking emoticons button', async () => {
      render(<Toolbar />);

      const emoticonButton = screen.getByRole('button', { name: 'main.toolbar.emoticons' });
      fireEvent.click(emoticonButton);

      const emojiPicker = await screen.findByTestId('emoji-picker');
      expect(emojiPicker).toBeInTheDocument();
    });

    it.each([
      [false, 'light'],
      [true, 'dark'],
    ])('should show the picker in the app\'s color scheme when dark mode is %s', async (isDarkMode, colorScheme) => {
      const settings = vi.mocked(settingsStore.useSettingsStore).getMockImplementation();
      vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
        settings?.((state) => selector({ ...state, isDarkMode } as settingsStore.SettingsStore)) as never);
      render(<Toolbar />);

      fireEvent.click(screen.getByRole('button', { name: 'main.toolbar.emoticons' }));

      expect(await screen.findByTestId('emoji-picker')).toHaveAttribute('data-color-scheme', colorScheme);
    });

    it('should insert emoji into message input when clicking an emoji', async () => {
      render(<Toolbar />);

      const emoticonButton = screen.getByRole('button', { name: 'main.toolbar.emoticons' });
      fireEvent.click(emoticonButton);

      const emojiButton = await screen.findByTestId('emoji-grinning');
      fireEvent.click(emojiButton);

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('😀');
    });

    it('should append emoji to existing message', async () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hello ' } });

      const emoticonButton = screen.getByRole('button', { name: 'main.toolbar.emoticons' });
      fireEvent.click(emoticonButton);

      const emojiButton = await screen.findByTestId('emoji-heart');
      fireEvent.click(emojiButton);

      expect(input).toHaveValue('Hello ❤️');
    });

    it('should close emoji picker after selecting an emoji', async () => {
      render(<Toolbar />);

      const emoticonButton = screen.getByRole('button', { name: 'main.toolbar.emoticons' });
      fireEvent.click(emoticonButton);

      const emojiButton = await screen.findByTestId('emoji-grinning');
      fireEvent.click(emojiButton);

      await waitFor(() => {
        expect(screen.queryByTestId('emoji-picker')).not.toBeInTheDocument();
      });
    });

    it('should allow sending message with emoji', async () => {
      render(<Toolbar />);

      const emoticonButton = screen.getByRole('button', { name: 'main.toolbar.emoticons' });
      fireEvent.click(emoticonButton);

      const emojiButton = await screen.findByTestId('emoji-grinning');
      fireEvent.click(emojiButton);

      const input = screen.getByRole('textbox');
      const form = input.closest('form');
      fireEvent.submit(form as HTMLFormElement);

      expect(network.ircSendCommand).toHaveBeenCalledWith('PRIVMSG #test :😀', { window: '#test' });
    });
  });

  describe('User avatar', () => {
    const getAvatarButton = () => {
      // The avatar button is the first button in the form with data-state attribute
      const buttons = screen.getAllByRole('button');
      return buttons.find((btn) => btn.getAttribute('aria-haspopup') === 'menu');
    };

    it('should render avatar with first letter of nick', () => {
      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeInTheDocument();
      expect(avatarButton?.textContent).toContain('T'); // First letter of 'testUser'
    });

    it('should display uppercase first letter', () => {
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'lowercase',
          currentUserFlags: [],
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton?.textContent).toContain('L'); // Uppercase L
    });

    it('should open dropdown menu when clicking avatar', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeDefined();
      await user.click(avatarButton as HTMLElement);

      // Radix UI dropdown menu renders content in a portal to document.body
      expect(document.body.textContent).toContain('profileSettings.title');
    });

    it('should show Profile Settings option in menu', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeDefined();
      await user.click(avatarButton as HTMLElement);

      expect(document.body.textContent).toContain('profileSettings.title');
    });

    it('should not show Away Messages option when no away messages', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeDefined();
      await user.click(avatarButton as HTMLElement);

      expect(document.body.textContent).not.toContain('currentUser.awayMessages');
    });

    it('should not show badge when no away messages', () => {
      render(<Toolbar />);

      // Badge should not be visible (no element with the badge class inside avatar)
      const avatarButton = getAvatarButton();
      const badge = avatarButton?.querySelector('.bg-red-500');
      expect(badge).not.toBeInTheDocument();
    });

    it('should not show away icon when user is not away', () => {
      render(<Toolbar />);

      // Away icon (moon) should not be visible
      const awayIcon = document.querySelector('.bg-yellow-500');
      expect(awayIcon).not.toBeInTheDocument();
    });
  });

  describe('User avatar away status indicator', () => {
    const getAvatarContainer = () => {
      // The avatar container is the relative div that contains the badges
      return document.querySelector('.relative.mr-2');
    };

    it('should show away icon (moon) when user is away', () => {
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserAvatar: undefined,
          currentUserFlags: ['away'],
          isAutoAway: false,
          isConnected: true,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      render(<Toolbar />);

      // Away icon should be visible with yellow background
      const awayIcon = document.querySelector('.bg-yellow-500');
      expect(awayIcon).toBeInTheDocument();
    });

    it('should position away icon on top-left of avatar', () => {
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserAvatar: undefined,
          currentUserFlags: ['away'],
          isAutoAway: false,
          isConnected: true,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      render(<Toolbar />);

      const awayIcon = document.querySelector('.bg-yellow-500');
      expect(awayIcon).toHaveClass('-top-1');
      expect(awayIcon).toHaveClass('-left-1');
    });

    it('should not show away icon when user is not away', () => {
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserAvatar: undefined,
          currentUserFlags: [],
          isAutoAway: false,
          isConnected: true,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      render(<Toolbar />);

      const awayIcon = document.querySelector('.bg-yellow-500');
      expect(awayIcon).not.toBeInTheDocument();
    });

    it('should show both away icon and message count badge simultaneously', () => {
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserAvatar: undefined,
          currentUserFlags: ['away'],
          isAutoAway: false,
          isConnected: true,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      mockAwayMessages = [
        {
          id: 'msg-1',
          message: 'Hey testUser!',
          nick: 'sender1',
          target: '#test',
          time: '2024-01-01T12:00:00.000Z',
          category: 'default',
          color: '#000',
          channel: '#test',
        },
      ];

      render(<Toolbar />);

      const avatarContainer = getAvatarContainer();

      // Away icon on left (yellow)
      const awayIcon = avatarContainer?.querySelector('.bg-yellow-500');
      expect(awayIcon).toBeInTheDocument();
      expect(awayIcon).toHaveClass('-left-1');

      // Message count badge on right (red)
      const messageBadge = avatarContainer?.querySelector('.bg-red-500');
      expect(messageBadge).toBeInTheDocument();
      expect(messageBadge).toHaveClass('-right-1');
    });

    it('should show away icon for auto-away status', () => {
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserAvatar: undefined,
          currentUserFlags: ['away'],
          isAutoAway: true,
          isConnected: true,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      render(<Toolbar />);

      const awayIcon = document.querySelector('.bg-yellow-500');
      expect(awayIcon).toBeInTheDocument();
    });

    it('should show away icon with other user flags present', () => {
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserAvatar: undefined,
          currentUserFlags: ['r', 'away', 'someOtherFlag'],
          isAutoAway: false,
          isConnected: true,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      render(<Toolbar />);

      const awayIcon = document.querySelector('.bg-yellow-500');
      expect(awayIcon).toBeInTheDocument();
    });
  });

  describe('User avatar with away messages', () => {
    const getAvatarButton = () => {
      const buttons = screen.getAllByRole('button');
      return buttons.find((btn) => btn.getAttribute('aria-haspopup') === 'menu');
    };

    it('should show Away Messages option in menu when there are away messages', async () => {
      mockAwayMessages = [
        {
          id: 'msg-1',
          message: 'Hey testUser!',
          nick: 'sender1',
          target: '#test',
          time: '2024-01-01T12:00:00.000Z',
          category: 'default',
          color: '#000',
          channel: '#test',
        },
      ];

      const user = userEvent.setup();
      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeDefined();
      await user.click(avatarButton as HTMLElement);

      expect(document.body.textContent).toContain('currentUser.awayMessages');
    });

    it('should show badge with count when there are away messages', () => {
      mockAwayMessages = [
        {
          id: 'msg-1',
          message: 'Hey testUser!',
          nick: 'sender1',
          target: '#test',
          time: '2024-01-01T12:00:00.000Z',
          category: 'default',
          color: '#000',
          channel: '#test',
        },
        {
          id: 'msg-2',
          message: 'testUser are you there?',
          nick: 'sender2',
          target: '#test',
          time: '2024-01-01T12:01:00.000Z',
          category: 'default',
          color: '#000',
          channel: '#test',
        },
      ];

      render(<Toolbar />);

      // Check for badge with count
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should show message count in menu badge when there are away messages', async () => {
      const user = userEvent.setup();
      mockAwayMessages = [
        {
          id: 'msg-1',
          message: 'Hey testUser!',
          nick: 'sender1',
          target: '#test',
          time: '2024-01-01T12:00:00.000Z',
          category: 'default',
          color: '#000',
          channel: '#test',
        },
      ];

      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeDefined();
      await user.click(avatarButton as HTMLElement);

      // Should show count in menu item as well
      const menuBadges = screen.getAllByText('1');
      expect(menuBadges.length).toBeGreaterThan(0);
    });
  });

  describe('Auto-away functionality', () => {
    const mockSetIsAutoAway = vi.fn();

    beforeEach(() => {
      vi.useFakeTimers();
      vi.spyOn(networksStore, 'setIsAutoAway').mockImplementation(mockSetIsAutoAway);

      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: [],
          isAutoAway: false,
          isConnected: true,
          setIsAutoAway: mockSetIsAutoAway,
          autoAwayMinutes: 15,
          autoAwayMessage: '',
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      // Mock getState to return the same mock functions
      setTestSession({ currentUserFlags: [], isConnected: true });
      vi.spyOn(settingsStore.useSettingsStore, 'getState').mockReturnValue({ autoAwayMinutes: 15, autoAwayMessage: '' } as unknown as settingsStore.SettingsStore);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should send AWAY command after 15 minutes of inactivity', () => {
      render(<Toolbar />);

      // Fast forward 15 minutes
      vi.advanceTimersByTime(15 * 60 * 1000);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('AWAY :currentUser.autoAway');
      expect(mockSetIsAutoAway).toHaveBeenCalledWith(true);
    });

    it('should not send AWAY command before 15 minutes', () => {
      render(<Toolbar />);

      // Fast forward 14 minutes
      vi.advanceTimersByTime(14 * 60 * 1000);

      expect(network.ircSendRawMessage).not.toHaveBeenCalledWith('AWAY :currentUser.autoAway');
    });

    it('should reset inactivity timer when sending a message', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');

      // Fast forward 10 minutes
      vi.advanceTimersByTime(10 * 60 * 1000);

      // Send a message
      fireEvent.change(input, { target: { value: 'Hello' } });
      const form = input.closest('form');
      fireEvent.submit(form as HTMLFormElement);

      // Fast forward another 10 minutes (total 20 from start, but only 10 since last message)
      vi.advanceTimersByTime(10 * 60 * 1000);

      // Should not be away yet because timer was reset
      expect(network.ircSendRawMessage).not.toHaveBeenCalledWith('AWAY :currentUser.autoAway');

      // Fast forward another 5 minutes (15 total since last message)
      vi.advanceTimersByTime(5 * 60 * 1000);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('AWAY :currentUser.autoAway');
    });

    it('should turn off auto-away when user sends a message', () => {
      // Set up as auto-away
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: ['away'],
          isAutoAway: true,
          isConnected: true,
          setIsAutoAway: mockSetIsAutoAway,
          autoAwayMinutes: 15,
          autoAwayMessage: '',
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      setTestSession({ currentUserFlags: ['away'], isConnected: true });
      vi.spyOn(settingsStore.useSettingsStore, 'getState').mockReturnValue({ autoAwayMinutes: 15, autoAwayMessage: '' } as unknown as settingsStore.SettingsStore);

      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hello' } });
      const form = input.closest('form');
      fireEvent.submit(form as HTMLFormElement);

      // Should send AWAY with no message to turn it off
      expect(network.ircSendRawMessage).toHaveBeenCalledWith('AWAY');
      expect(mockSetIsAutoAway).toHaveBeenCalledWith(false);
    });

    it('should not turn off away if it was set manually', () => {
      // Set up as manually away (not auto)
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: ['away'],
          isAutoAway: false,
          isConnected: true,
          setIsAutoAway: mockSetIsAutoAway,
          autoAwayMinutes: 15,
          autoAwayMessage: '',
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      setTestSession({ currentUserFlags: ['away'], isConnected: true });
      vi.spyOn(settingsStore.useSettingsStore, 'getState').mockReturnValue({ autoAwayMinutes: 15, autoAwayMessage: '' } as unknown as settingsStore.SettingsStore);

      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hello' } });
      const form = input.closest('form');
      fireEvent.submit(form as HTMLFormElement);

      // Should NOT send AWAY command to turn it off
      expect(network.ircSendRawMessage).not.toHaveBeenCalledWith('AWAY');
    });

    it('should not set auto-away if already manually away', () => {
      setTestSession({ currentUserFlags: ['away'], isConnected: true });
      vi.spyOn(settingsStore.useSettingsStore, 'getState').mockReturnValue({ autoAwayMinutes: 15, autoAwayMessage: '' } as unknown as settingsStore.SettingsStore);

      render(<Toolbar />);

      // Fast forward 15 minutes
      vi.advanceTimersByTime(15 * 60 * 1000);

      // Should not send AWAY command because user is already away
      expect(network.ircSendRawMessage).not.toHaveBeenCalledWith('AWAY :currentUser.autoAway');
    });

    it('should not set auto-away if not connected', () => {
      setTestSession({ currentUserFlags: [], isConnected: false });
      vi.spyOn(settingsStore.useSettingsStore, 'getState').mockReturnValue({ autoAwayMinutes: 15, autoAwayMessage: '' } as unknown as settingsStore.SettingsStore);

      render(<Toolbar />);

      // Fast forward 15 minutes
      vi.advanceTimersByTime(15 * 60 * 1000);

      // Should not send AWAY command because not connected
      expect(network.ircSendRawMessage).not.toHaveBeenCalledWith('AWAY :currentUser.autoAway');
    });

    it('should not turn off auto-away if not connected', () => {
      // Set up as auto-away but not connected
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: ['away'],
          isAutoAway: true,
          isConnected: false,
          setIsAutoAway: mockSetIsAutoAway,
          autoAwayMinutes: 15,
          autoAwayMessage: '',
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      setTestSession({ currentUserFlags: ['away'], isConnected: false });
      vi.spyOn(settingsStore.useSettingsStore, 'getState').mockReturnValue({ autoAwayMinutes: 15, autoAwayMessage: '' } as unknown as settingsStore.SettingsStore);

      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hello' } });
      const form = input.closest('form');
      fireEvent.submit(form as HTMLFormElement);

      // Should NOT send AWAY command because not connected
      expect(network.ircSendRawMessage).not.toHaveBeenCalledWith('AWAY');
    });
      describe('with the user settings', () => {
      const mockAutoAwaySettings = (autoAwayMinutes: number, autoAwayMessage = '') => {
        const state = {
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: [],
          isAutoAway: false,
          isConnected: true,
          setIsAutoAway: mockSetIsAutoAway,
          autoAwayMinutes,
          autoAwayMessage,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        } as unknown as settingsStore.SettingsStore;
        mockStoreState(state);
        setTestSession({ currentUserFlags: [], isConnected: true });
        vi.spyOn(settingsStore.useSettingsStore, 'getState').mockReturnValue(state);
      };

      it('goes away after the chosen time', () => {
        mockAutoAwaySettings(5);
        render(<Toolbar />);

        vi.advanceTimersByTime(5 * 60 * 1000 - 1);
        expect(network.ircSendRawMessage).not.toHaveBeenCalledWith('AWAY :currentUser.autoAway');

        vi.advanceTimersByTime(1);
        expect(network.ircSendRawMessage).toHaveBeenCalledWith('AWAY :currentUser.autoAway');
      });

      it('never goes away when turned off', () => {
        mockAutoAwaySettings(0);
        render(<Toolbar />);

        vi.advanceTimersByTime(24 * 60 * 60 * 1000);

        expect(network.ircSendRawMessage).not.toHaveBeenCalledWith(expect.stringMatching(/^AWAY/));
        expect(mockSetIsAutoAway).not.toHaveBeenCalled();
      });

      it('sends the user\'s own away message', () => {
        mockAutoAwaySettings(5, '  out for lunch ');
        render(<Toolbar />);

        vi.advanceTimersByTime(5 * 60 * 1000);

        expect(network.ircSendRawMessage).toHaveBeenCalledWith('AWAY :out for lunch');
      });

      it('sends the default message when the user\'s own is blank', () => {
        mockAutoAwaySettings(5, '   ');
        render(<Toolbar />);

        vi.advanceTimersByTime(5 * 60 * 1000);

        expect(network.ircSendRawMessage).toHaveBeenCalledWith('AWAY :currentUser.autoAway');
      });

      it('counts a changed time from the change', () => {
        mockAutoAwaySettings(15);
        const { rerender } = render(<Toolbar />);
        vi.advanceTimersByTime(2 * 60 * 1000);

        mockAutoAwaySettings(5);
        rerender(<Toolbar />);
        vi.advanceTimersByTime(4 * 60 * 1000);
        expect(network.ircSendRawMessage).not.toHaveBeenCalledWith('AWAY :currentUser.autoAway');

        vi.advanceTimersByTime(60 * 1000);
        expect(network.ircSendRawMessage).toHaveBeenCalledExactlyOnceWith('AWAY :currentUser.autoAway');
      });

      it('stops the countdown when turned off', () => {
        mockAutoAwaySettings(5);
        const { rerender } = render(<Toolbar />);
        vi.advanceTimersByTime(4 * 60 * 1000);

        mockAutoAwaySettings(0);
        rerender(<Toolbar />);
        vi.advanceTimersByTime(60 * 60 * 1000);

        expect(network.ircSendRawMessage).not.toHaveBeenCalledWith(expect.stringMatching(/^AWAY/));
      });
    });
  });

  describe('Autocomplete commands', () => {
    it('should autocomplete command when pressing Tab after /', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '/jo' } });
      fireEvent.keyUp(input, { key: 'o' }); // Trigger keyUp to set autocompleteMessage
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(input).toHaveValue('/join ');
    });

    it('should cycle through matching commands on multiple Tab presses', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '/a' } });
      fireEvent.keyUp(input, { key: 'a' });
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(input).toHaveValue('/all ');

      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('/amsg ');

      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('/away ');
    });

    it('should wrap around to first matching command after last match', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '/whe' } });
      fireEvent.keyUp(input, { key: 'e' });

      // First Tab - /whereis (only command starting with /whe)
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('/whereis ');

      // Second Tab - wraps back to /whereis
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('/whereis ');
    });

    it('should not autocomplete if no matching command', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '/xyz' } });
      fireEvent.keyUp(input, { key: 'z' });
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(input).toHaveValue('/xyz');
    });

    it('should autocomplete command in multi-word message', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'hello /jo' } });
      fireEvent.keyUp(input, { key: 'o' });
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(input).toHaveValue('hello /join ');
    });
  });

  describe('Autocomplete channels', () => {
    beforeEach(() => {
      vi.spyOn(channelList, 'getChannelListSortedByAZ').mockReturnValue([
        { name: '#general', users: 10, topic: 'General chat' },
        { name: '#help', users: 5, topic: 'Help channel' },
        { name: '#random', users: 8, topic: 'Random stuff' },
      ]);
    });

    it('should autocomplete channel when pressing Tab after #', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '#gen' } });
      fireEvent.keyUp(input, { key: 'n' });
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(input).toHaveValue('#general ');
    });

    it('should cycle through matching channels on multiple Tab presses', () => {
      vi.spyOn(channelList, 'getChannelListSortedByAZ').mockReturnValue([
        { name: '#help', users: 5, topic: 'Help channel' },
        { name: '#hello', users: 3, topic: 'Hello channel' },
        { name: '#helpdesk', users: 2, topic: 'Help desk' },
      ]);

      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '#hel' } });
      fireEvent.keyUp(input, { key: 'l' });

      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('#help ');

      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('#hello ');

      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('#helpdesk ');
    });

    it('should wrap around to first matching channel after last match', () => {
      vi.spyOn(channelList, 'getChannelListSortedByAZ').mockReturnValue([
        { name: '#alpha', users: 5, topic: '' },
        { name: '#beta', users: 3, topic: '' },
      ]);

      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '#' } });
      fireEvent.keyUp(input, { key: '#' });

      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('#alpha ');

      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('#beta ');

      // Wrap around
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('#alpha ');
    });

    it('should not autocomplete if no matching channel', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '#xyz' } });
      fireEvent.keyUp(input, { key: 'z' });
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(input).toHaveValue('#xyz');
    });

    it('should autocomplete channel in multi-word message', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '/join #gen' } });
      fireEvent.keyUp(input, { key: 'n' });
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(input).toHaveValue('/join #general ');
    });
  });

  describe('Autocomplete users', () => {
    const mockUsersStore = (usersList: { nick: string; ident: string; hostname: string; flags: string[]; channels: { name: string; flags: string[]; maxPermission: number }[] }[]) => {
      vi.spyOn(users, 'useActiveUsers').mockImplementation((selector) =>
        selector({ users: usersList })
      );
    };

    beforeEach(() => {
      mockUsersStore([
        { nick: 'alice', ident: 'alice', hostname: 'host', flags: [], channels: [{ name: '#test', flags: [], maxPermission: 0 }] },
        { nick: 'bob', ident: 'bob', hostname: 'host', flags: [], channels: [{ name: '#test', flags: [], maxPermission: 0 }] },
        { nick: 'charlie', ident: 'charlie', hostname: 'host', flags: [], channels: [{ name: '#test', flags: [], maxPermission: 0 }] },
      ]);
    });

    it('should autocomplete user when pressing Tab', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'al' } });
      fireEvent.keyUp(input, { key: 'l' });
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(input).toHaveValue('alice ');
    });

    it('should cycle through matching users on multiple Tab presses', () => {
      mockUsersStore([
        { nick: 'alex', ident: 'alex', hostname: 'host', flags: [], channels: [{ name: '#test', flags: [], maxPermission: 0 }] },
        { nick: 'alice', ident: 'alice', hostname: 'host', flags: [], channels: [{ name: '#test', flags: [], maxPermission: 0 }] },
        { nick: 'alfred', ident: 'alfred', hostname: 'host', flags: [], channels: [{ name: '#test', flags: [], maxPermission: 0 }] },
      ]);

      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'al' } });
      fireEvent.keyUp(input, { key: 'l' });

      // Users are sorted alphabetically: alex, alfred, alice
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('alex ');

      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('alfred ');

      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('alice ');
    });

    it('should wrap around to first matching user after last match', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'b' } });
      fireEvent.keyUp(input, { key: 'b' });

      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('bob ');

      // Wrap around (only one user matches 'b')
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('bob ');
    });

    it('should not autocomplete if no matching user', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'xyz' } });
      fireEvent.keyUp(input, { key: 'z' });
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(input).toHaveValue('xyz');
    });

    it('should autocomplete user in multi-word message', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'hello al' } });
      fireEvent.keyUp(input, { key: 'l' });
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(input).toHaveValue('hello alice ');
    });

    it('should be case insensitive when matching users', () => {
      mockUsersStore([
        { nick: 'Alice', ident: 'alice', hostname: 'host', flags: [], channels: [{ name: '#test', flags: [], maxPermission: 0 }] },
      ]);

      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'al' } });
      fireEvent.keyUp(input, { key: 'l' });
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(input).toHaveValue('Alice ');
    });

    it('should reset autocomplete index when typing different characters', () => {
      mockUsersStore([
        { nick: 'alex', ident: 'alex', hostname: 'host', flags: [], channels: [{ name: '#test', flags: [], maxPermission: 0 }] },
        { nick: 'alice', ident: 'alice', hostname: 'host', flags: [], channels: [{ name: '#test', flags: [], maxPermission: 0 }] },
        { nick: 'bob', ident: 'bob', hostname: 'host', flags: [], channels: [{ name: '#test', flags: [], maxPermission: 0 }] },
      ]);

      render(<Toolbar />);

      const input = screen.getByRole('textbox');

      // Start autocomplete for 'al'
      fireEvent.change(input, { target: { value: 'al' } });
      fireEvent.keyUp(input, { key: 'l' });
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('alex ');

      // Type a new character - should reset
      fireEvent.change(input, { target: { value: 'bo' } });
      fireEvent.keyUp(input, { key: 'o' });
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('bob ');
    });

    it('should not autocomplete on empty input', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyUp(input, { key: '' });
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(input).toHaveValue('');
    });
  });

  describe('Connect/Disconnect button', () => {
    const getAvatarButton = () => {
      const buttons = screen.getAllByRole('button');
      return buttons.find((btn) => btn.getAttribute('aria-haspopup') === 'menu');
    };

    beforeEach(() => {
      mockResetAndGoToStart.mockClear();
      mockChangeServer.mockClear();
    });

    it('should show Disconnect option when connected', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeDefined();
      await user.click(avatarButton as HTMLElement);

      expect(document.body.textContent).toContain('currentUser.disconnect');
      expect(document.body.textContent).not.toContain('currentUser.connect');
    });

    it('should call resetAndGoToStart when clicking Disconnect', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeDefined();
      await user.click(avatarButton as HTMLElement);

      // Find and click the Disconnect menu item
      const disconnectItem = screen.getByText('currentUser.disconnect');
      await user.click(disconnectItem);

      expect(mockResetAndGoToStart).toHaveBeenCalledTimes(1);
    });

    it('should show Disconnect option with separator from other menu items', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeDefined();
      await user.click(avatarButton as HTMLElement);

      // Verify both Profile Settings and Disconnect are in the menu
      expect(document.body.textContent).toContain('profileSettings.title');
      expect(document.body.textContent).toContain('currentUser.disconnect');

      // Check that a separator exists (Radix UI renders it with role="separator")
      const separator = document.querySelector('[role="separator"]');
      expect(separator).toBeInTheDocument();
    });

    it('should show Connect option when disconnected', async () => {
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: [],
          isConnected: false,
          isAutoAway: false,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      const user = userEvent.setup();
      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeDefined();
      await user.click(avatarButton as HTMLElement);

      expect(document.body.textContent).toContain('currentUser.connect');
      expect(document.body.textContent).not.toContain('currentUser.disconnect');
    });

    it('should call ircReconnect when clicking Connect', async () => {
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: [],
          isConnected: false,
          isAutoAway: false,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      const user = userEvent.setup();
      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeDefined();
      await user.click(avatarButton as HTMLElement);

      const connectItem = screen.getByText('currentUser.connect');
      await user.click(connectItem);

      expect(network.ircReconnect).toHaveBeenCalledTimes(1);
    });

    it('should show Connecting text and disable Connect when isConnecting is true', async () => {
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: [],
          isConnected: false,
          isConnecting: true,
          isAutoAway: false,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      const user = userEvent.setup();
      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeDefined();
      await user.click(avatarButton as HTMLElement);

      expect(document.body.textContent).toContain('currentUser.connecting');
      expect(document.body.textContent).not.toContain('currentUser.disconnect');
    });

    it('should mark Connect menu item as disabled when connecting', async () => {
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: [],
          isConnected: false,
          isConnecting: true,
          isAutoAway: false,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      const user = userEvent.setup();
      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeDefined();
      await user.click(avatarButton as HTMLElement);

      const connectingItem = screen.getByText('currentUser.connecting');
      expect(connectingItem.closest('[data-disabled]')).toBeInTheDocument();
    });

    it('should not call resetAndGoToStart when clicking Connect', async () => {
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: [],
          isConnected: false,
          isAutoAway: false,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      const user = userEvent.setup();
      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeDefined();
      await user.click(avatarButton as HTMLElement);

      const connectItem = screen.getByText('currentUser.connect');
      await user.click(connectItem);

      expect(mockResetAndGoToStart).not.toHaveBeenCalled();
    });

    it('should show Change Server option when disconnected', async () => {
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: [],
          isConnected: false,
          isAutoAway: false,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      const user = userEvent.setup();
      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeDefined();
      await user.click(avatarButton as HTMLElement);

      expect(document.body.textContent).toContain('currentUser.changeServer');
    });

    it('should not show Change Server option when connected', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeDefined();
      await user.click(avatarButton as HTMLElement);

      expect(document.body.textContent).not.toContain('currentUser.changeServer');
    });

    it('should call changeServer when clicking Change Server', async () => {
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: [],
          isConnected: false,
          isAutoAway: false,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      const user = userEvent.setup();
      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeDefined();
      await user.click(avatarButton as HTMLElement);

      const changeServerItem = screen.getByText('currentUser.changeServer');
      await user.click(changeServerItem);

      expect(mockChangeServer).toHaveBeenCalledTimes(1);
    });

    it('should hide Change Server when connecting', async () => {
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: [],
          isConnected: false,
          isConnecting: true,
          isAutoAway: false,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      const user = userEvent.setup();
      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeDefined();
      await user.click(avatarButton as HTMLElement);

      expect(screen.queryByText('currentUser.changeServer')).not.toBeInTheDocument();
    });
  });

  describe('Typing indicator', () => {
    beforeEach(() => {
      vi.spyOn(capabilities, 'isCapabilityEnabled').mockImplementation((cap) => cap === 'message-tags');
    });

    it('does not send typing notifications to a server without message-tags', () => {
      vi.spyOn(capabilities, 'isCapabilityEnabled').mockReturnValue(false);
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hi' } });
      fireEvent.submit(input.closest('form') as HTMLFormElement);

      expect(network.ircSendRawMessage).not.toHaveBeenCalledWith(expect.stringContaining('TAGMSG'));
    });

    it('should send typing=active TAGMSG when user starts typing', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'H' } });

      expect(network.ircSendRawMessage).toHaveBeenCalledWith(
        '@+draft/typing=active;+typing=active TAGMSG #test'
      );
    });

    it('should only send typing=active once, not on every keystroke', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');

      // First keystroke
      fireEvent.change(input, { target: { value: 'H' } });
      // Second keystroke
      fireEvent.change(input, { target: { value: 'He' } });
      // Third keystroke
      fireEvent.change(input, { target: { value: 'Hel' } });

      // Should only have been called once with the typing=active message
      const typingCalls = (network.ircSendRawMessage as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call) => call[0] === '@+draft/typing=active;+typing=active TAGMSG #test'
      );
      expect(typingCalls).toHaveLength(1);
    });

    it('should send typing=done TAGMSG when message is submitted', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hello world' } });

      const form = input.closest('form');
      fireEvent.submit(form as HTMLFormElement);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith(
        '@+draft/typing=done;+typing=done TAGMSG #test'
      );
    });

    it('should not send typing TAGMSG for STATUS_CHANNEL', () => {
      mockStoreState({
          currentChannelName: 'Status',
          currentChannelCategory: ChannelCategory.status,
          nick: 'testUser',
          currentUserFlags: [],
          isConnected: true,
          isAutoAway: false,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hello' } });

      expect(network.ircSendRawMessage).not.toHaveBeenCalledWith(
        expect.stringContaining('TAGMSG'),
        expect.anything()
      );
    });

    it('keeps text typed in Status in the input, unsent, and says it takes commands only', () => {
      mockStoreState({
          currentChannelName: 'Status',
          currentChannelCategory: ChannelCategory.status,
          nick: 'testUser',
          currentUserFlags: [],
          isConnected: true,
          isAutoAway: false,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'join #help' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(network.ircSendCommand).not.toHaveBeenCalled();
      expect(input).toHaveValue('join #help');
      expect(mockSetAddMessage).toHaveBeenCalledWith(expect.objectContaining({
        message: 'main.toolbar.noMessagesHere',
        target: 'Status',
        category: MessageCategory.info,
      }));
    });

    it('should not send typing TAGMSG for DEBUG_CHANNEL', () => {
      mockStoreState({
          currentChannelName: 'Debug',
          currentChannelCategory: ChannelCategory.status,
          nick: 'testUser',
          currentUserFlags: [],
          isConnected: true,
          isAutoAway: false,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      render(<Toolbar />);

      // DEBUG_CHANNEL doesn't render the input, so nothing to test for typing
      const input = screen.queryByRole('textbox');
      expect(input).not.toBeInTheDocument();
    });

    it('should reset typing status and send typing=done when message is sent', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');

      // Start typing
      fireEvent.change(input, { target: { value: 'Hello' } });

      // Submit message
      const form = input.closest('form');
      fireEvent.submit(form as HTMLFormElement);

      // Verify typing=done was sent
      expect(network.ircSendRawMessage).toHaveBeenCalledWith(
        '@+draft/typing=done;+typing=done TAGMSG #test'
      );

      // Clear mocks and type again - should send typing=active again
      vi.clearAllMocks();
      fireEvent.change(input, { target: { value: 'New message' } });

      expect(network.ircSendRawMessage).toHaveBeenCalledWith(
        '@+draft/typing=active;+typing=active TAGMSG #test'
      );
    });

    it('should send typing indicator to correct channel', () => {
      mockStoreState({
          currentChannelName: '#mychannel',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: [],
          isConnected: true,
          isAutoAway: false,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hello' } });

      expect(network.ircSendRawMessage).toHaveBeenCalledWith(
        '@+draft/typing=active;+typing=active TAGMSG #mychannel'
      );
    });

    it('should send typing indicator for private messages', () => {
      mockStoreState({
          currentChannelName: 'someuser',
          currentChannelCategory: ChannelCategory.priv,
          nick: 'testUser',
          currentUserFlags: [],
          isConnected: true,
          isAutoAway: false,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hello' } });

      expect(network.ircSendRawMessage).toHaveBeenCalledWith(
        '@+draft/typing=active;+typing=active TAGMSG someuser'
      );
    });
  });

  describe('Dark mode toggle', () => {
    const getAvatarButton = () => {
      const buttons = screen.getAllByRole('button');
      return buttons.find((btn) => btn.getAttribute('aria-haspopup') === 'menu');
    };

    it('should show dark mode option in dropdown menu when in light mode', async () => {
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: [],
          isDarkMode: false,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      const user = userEvent.setup();
      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeDefined();
      await user.click(avatarButton as HTMLElement);

      expect(document.body.textContent).toContain('currentUser.darkMode');
    });

    it('should show light mode option in dropdown menu when in dark mode', async () => {
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: [],
          isDarkMode: true,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      const user = userEvent.setup();
      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeDefined();
      await user.click(avatarButton as HTMLElement);

      expect(document.body.textContent).toContain('currentUser.lightMode');
    });

    it('should call toggleDarkMode when clicking the dark mode option', async () => {
      const mockToggleDarkMode = vi.fn();
      vi.spyOn(settingsStore, 'toggleDarkMode').mockImplementation(mockToggleDarkMode);

      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: [],
          isDarkMode: false,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        });

      const user = userEvent.setup();
      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeDefined();
      await user.click(avatarButton as HTMLElement);

      const darkModeItem = screen.getByText('currentUser.darkMode');
      await user.click(darkModeItem);

      expect(mockToggleDarkMode).toHaveBeenCalledTimes(1);
    });
  });

  describe('Keyboard shortcuts menu item', () => {
    it('should open the keyboard shortcuts list', async () => {
      useShortcutsStore.setState({ openDialog: null });
      const user = userEvent.setup();
      render(<Toolbar />);

      await user.click(screen.getByRole('button', { name: 'main.toolbar.userMenu' }));
      await user.click(screen.getByText('currentUser.keyboardShortcuts'));

      expect(useShortcutsStore.getState().openDialog).toBe('help');
    });
  });

  describe('Echo-message capability handling', () => {
    it('should add message locally when echo-message capability is NOT enabled', () => {
      vi.spyOn(capabilities, 'isCapabilityEnabled').mockReturnValue(false);

      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hello world' } });

      const form = input.closest('form');
      fireEvent.submit(form as HTMLFormElement);

      // Message should be added locally
      expect(mockSetAddMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Hello world',
          target: '#test',
        })
      );
    });

    it('should NOT add message locally when echo-message capability is enabled', () => {
      vi.spyOn(capabilities, 'isCapabilityEnabled').mockReturnValue(true);

      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hello world' } });

      const form = input.closest('form');
      fireEvent.submit(form as HTMLFormElement);

      // Message should NOT be added locally (server echo will add it)
      expect(mockSetAddMessage).not.toHaveBeenCalled();
    });

    it('should still send PRIVMSG to server regardless of echo-message capability', () => {
      vi.spyOn(capabilities, 'isCapabilityEnabled').mockReturnValue(true);

      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hello world' } });

      const form = input.closest('form');
      fireEvent.submit(form as HTMLFormElement);

      // PRIVMSG should still be sent to server
      expect(network.ircSendCommand).toHaveBeenCalledWith('PRIVMSG #test :Hello world', { window: '#test' });
    });

    it('should check specifically for echo-message capability', () => {
      const mockIsCapabilityEnabled = vi.spyOn(capabilities, 'isCapabilityEnabled').mockReturnValue(false);

      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Test message' } });

      const form = input.closest('form');
      fireEvent.submit(form as HTMLFormElement);

      expect(mockIsCapabilityEnabled).toHaveBeenCalledWith('echo-message');
    });

    it('shows what a command sends when the server does not echo it', () => {
      const showOwn = vi.spyOn(ownMessages, 'showOwnCommandMessages').mockImplementation(() => {});
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '/me waves' } });
      fireEvent.submit(input.closest('form') as HTMLFormElement);

      expect(showOwn).toHaveBeenCalledWith('PRIVMSG #test :\x01ACTION waves\x01', '#test');
      expect(network.ircSendCommand).toHaveBeenCalledWith('PRIVMSG #test :\x01ACTION waves\x01', { window: '#test' });
    });

    it('leaves what a command sends to the echo when the server has echo-message', () => {
      vi.spyOn(capabilities, 'isCapabilityEnabled').mockReturnValue(true);
      const showOwn = vi.spyOn(ownMessages, 'showOwnCommandMessages').mockImplementation(() => {});
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '/me waves' } });
      fireEvent.submit(input.closest('form') as HTMLFormElement);

      expect(showOwn).not.toHaveBeenCalled();
    });
  });

  describe('Unhappy paths', () => {
    it('should send whitespace-only message as PRIVMSG (not blocked)', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '   ' } });

      const form = input.closest('form');
      fireEvent.submit(form as HTMLFormElement);

      // Whitespace-only messages are not blocked — only truly empty strings are
      expect(network.ircSendCommand).toHaveBeenCalledWith('PRIVMSG #test :   ', { window: '#test' });
    });

    it('should route messages starting with / as commands, not PRIVMSG', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '/join #newchannel' } });

      const form = input.closest('form');
      fireEvent.submit(form as HTMLFormElement);

      // Should send raw command (lowercase, as typed), not PRIVMSG
      expect(network.ircSendCommand).toHaveBeenCalledWith('join #newchannel', { window: '#test' });
      expect(network.ircSendCommand).not.toHaveBeenCalledWith(expect.stringContaining('PRIVMSG'), expect.anything());
    });

    it('should save draft on channel switch and restore on return', () => {
      const { rerender } = render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'draft message' } });

      // Switch to a different channel
      mockStoreState({
          currentChannelName: '#other',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: [],
          isConnected: true,
          isAutoAway: false,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
          setFontFormatting: vi.fn(),
        });
      vi.spyOn(networksStore, 'getCurrentNick').mockReturnValue('testUser');

      rerender(<Toolbar />);

      // Input should be empty for the new channel
      expect(screen.getByRole('textbox')).toHaveValue('');

      // Switch back to original channel
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: [],
          isConnected: true,
          isAutoAway: false,
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
          setFontFormatting: vi.fn(),
        });

      rerender(<Toolbar />);

      // Draft should be restored
      expect(screen.getByRole('textbox')).toHaveValue('draft message');
    });

    it('should show away messages badge when count > 0', () => {
      mockAwayMessages = [{ nick: 'User1', message: 'hello', time: Date.now() }];

      render(<Toolbar />);

      // The badge should be present
      const badge = document.querySelector('[aria-label*="main.toolbar.awayMessageCount"]');
      expect(badge).toBeInTheDocument();
      expect(badge?.textContent).toBe('1');
    });
  });

  describe('Replies', () => {
    const question: Message = {
      id: 'm1',
      msgid: 'm1',
      message: 'the question',
      nick: 'alice',
      target: '#test',
      time: '2026-10-23T10:00:00.000Z',
      category: MessageCategory.default,
    };

    const send = (text: string): void => {
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: text } });
      fireEvent.submit(input.closest('form') as HTMLFormElement);
    };

    const withCapabilities = (...enabled: string[]): void => {
      vi.spyOn(capabilities, 'isCapabilityEnabled').mockImplementation((cap) => enabled.includes(cap));
    };

    beforeEach(() => {
      clearAllReplies();
    });

    it('shows the message being replied to above the input, and focuses it', () => {
      render(<Toolbar />);

      act(() => setReplyTo('#test', question));

      expect(screen.getByText(/main.toolbar.replyingTo/)).toHaveTextContent('the question');
      expect(screen.getByRole('textbox')).toHaveFocus();
    });

    it('keeps a spoiler hidden in the message being replied to', () => {
      render(<Toolbar />);

      act(() => setReplyTo('#test', { ...question, message: 'it was \x0314,14the butler\x03' }));

      expect(screen.getByText(/main.toolbar.replyingTo/)).toHaveTextContent('it was ▒▒▒');
      expect(screen.getByText(/main.toolbar.replyingTo/)).not.toHaveTextContent('butler');
    });

    it('cancels the reply from its bar or with Escape', () => {
      render(<Toolbar />);
      act(() => setReplyTo('#test', question));

      fireEvent.click(screen.getByRole('button', { name: 'main.toolbar.cancelReply' }));
      expect(getReplyTo('#test')).toBeUndefined();
      expect(screen.queryByText(/main.toolbar.replyingTo/)).not.toBeInTheDocument();

      act(() => setReplyTo('#test', question));
      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
      expect(getReplyTo('#test')).toBeUndefined();
    });

    it('refers to the message by its msgid where the server relays message tags', () => {
      withCapabilities('message-tags');
      setReplyTo('#test', question);
      render(<Toolbar />);

      send('the answer');

      expect(network.ircSendCommand).toHaveBeenCalledExactlyOnceWith('@+draft/reply=m1 PRIVMSG #test :the answer', { window: '#test' });
      expect(mockSetAddMessage).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: 'the answer', replyTo: 'm1' }));
      expect(getReplyTo('#test')).toBeUndefined();
    });

    it('waits for the echo to show it where the server echoes', () => {
      withCapabilities('message-tags', 'echo-message');
      setReplyTo('#test', question);
      render(<Toolbar />);

      send('the answer');

      expect(network.ircSendCommand).toHaveBeenCalledExactlyOnceWith('@+draft/reply=m1 PRIVMSG #test :the answer', { window: '#test' });
      expect(mockSetAddMessage).not.toHaveBeenCalled();
    });

    it.each([
      ['a server without message tags', () => withCapabilities(), question],
      ['a server that drops the reply tag', () => {
        withCapabilities('message-tags');
        vi.spyOn(networksStore, 'getClientTagDeny').mockReturnValue(['draft/reply']);
      }, question],
      ['a message without a msgid', () => withCapabilities('message-tags'), { ...question, msgid: undefined }],
    ])('quotes the message on a line of its own on %s', (_case, arrange, replied) => {
      arrange();
      setReplyTo('#test', replied);
      render(<Toolbar />);

      send('the answer');

      expect(vi.mocked(network.ircSendCommand).mock.calls).toEqual([
        ['PRIVMSG #test :> <alice> the question', { window: '#test' }],
        ['PRIVMSG #test :the answer', { window: '#test' }],
      ]);
      expect(mockSetAddMessage.mock.calls.map(([message]) => [(message as Message).message, (message as Message).replyTo])).toEqual([
        ['> <alice> the question', undefined],
        ['the answer', undefined],
      ]);
    });

    it('keeps the reply while a command is sent', () => {
      setReplyTo('#test', question);
      render(<Toolbar />);

      send('/join #other');

      expect(getReplyTo('#test')).toBe(question);
      expect(network.ircSendCommand).toHaveBeenCalledExactlyOnceWith(expect.not.stringContaining('draft/reply'), { window: '#test' });
    });

    it('sets the reply aside in an encrypted conversation', () => {
      setReplyTo('#test', question);
      setTestSlice(useE2eeStore, { sessions: { [getSessionKey('#test')]: { state: E2eeState.active } as E2eeSession } });

      render(<Toolbar />);

      expect(screen.queryByText(/main.toolbar.replyingTo/)).not.toBeInTheDocument();
      act(() => setTestSlice(useE2eeStore, { sessions: {} }));
      expect(screen.getByText(/main.toolbar.replyingTo/)).toBeInTheDocument();
    });

    it('keeps the reply of each window to itself', () => {
      setReplyTo('#other', question);
      render(<Toolbar />);

      expect(screen.queryByText(/main.toolbar.replyingTo/)).not.toBeInTheDocument();
      send('not an answer');

      expect(network.ircSendCommand).toHaveBeenCalledExactlyOnceWith('PRIVMSG #test :not an answer', { window: '#test' });
      expect(getReplyTo('#other')).toBe(question);
    });
  });

  describe('Multi-line messages', () => {
    beforeEach(() => {
      clearAllReplies();
    });

    const type = (text: string): HTMLTextAreaElement => {
      const input = screen.getByRole<HTMLTextAreaElement>('textbox');
      fireEvent.change(input, { target: { value: text } });
      return input;
    };

    const send = (text: string): void => {
      fireEvent.submit(type(text).closest('form') as HTMLFormElement);
    };

    const withMultiline = (...others: string[]): void => {
      vi.spyOn(capabilities, 'isCapabilityEnabled').mockImplementation((cap) => ['batch', 'draft/multiline', ...others].includes(cap));
      vi.spyOn(capabilities, 'getCapabilityValue').mockImplementation((cap) => (cap === 'draft/multiline' ? 'max-bytes=4096,max-lines=100' : undefined));
    };

    /** The reference of the batch the client opened */
    const sentReference = (): string => {
      const command = vi.mocked(network.ircSendCommand).mock.calls[0]?.[0] ?? '';
      return /BATCH \+(\S+)/.exec(command)?.[1] ?? '';
    };

    it('sends with Enter', () => {
      render(<Toolbar />);
      const input = type('hello');

      fireEvent.keyDown(input, { key: 'Enter' });

      expect(network.ircSendCommand).toHaveBeenCalledExactlyOnceWith('PRIVMSG #test :hello', { window: '#test' });
      expect(input).toHaveValue('');
    });

    it('starts a new line with Shift+Enter', () => {
      render(<Toolbar />);
      const input = type('hello');

      const notPrevented = fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });

      expect(notPrevented).toBe(true);
      expect(network.ircSendCommand).not.toHaveBeenCalled();
    });

    it('does not send with the Enter that confirms an IME composition', () => {
      render(<Toolbar />);
      const input = type('かな');

      fireEvent.keyDown(input, { key: 'Enter', isComposing: true });

      expect(network.ircSendCommand).not.toHaveBeenCalled();
      expect(input).toHaveValue('かな');
    });

    it('sends the lines as one draft/multiline batch and shows them as one message', () => {
      withMultiline();
      render(<Toolbar />);

      send('first\n\nsecond');

      const reference = sentReference();
      expect(network.ircSendCommand).toHaveBeenCalledExactlyOnceWith(`BATCH +${reference} draft/multiline #test`, { window: '#test' });
      expect(vi.mocked(network.ircSendRawMessage).mock.calls).toEqual([
        [`@batch=${reference} PRIVMSG #test :first`],
        [`@batch=${reference} PRIVMSG #test :`],
        [`@batch=${reference} PRIVMSG #test :second`],
        [`BATCH -${reference}`],
      ]);
      expect(mockSetAddMessage).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: 'first\n\nsecond', target: '#test' }));
    });

    it('waits for the echo of the batch where the server echoes', () => {
      withMultiline('echo-message');
      render(<Toolbar />);

      send('first\nsecond');

      expect(network.ircSendCommand).toHaveBeenCalledTimes(1);
      expect(mockSetAddMessage).not.toHaveBeenCalled();
    });

    it('puts the reply tag on the opening line of the batch', () => {
      withMultiline('message-tags');
      vi.spyOn(networksStore, 'getClientTagDeny').mockReturnValue([]);
      setReplyTo('#test', { id: 'm1', msgid: 'm1', message: 'question', nick: 'alice', target: '#test', time: '2026-10-23T10:00:00.000Z', category: MessageCategory.default });
      render(<Toolbar />);

      send('first\nsecond');

      expect(network.ircSendCommand).toHaveBeenCalledExactlyOnceWith(`@+draft/reply=m1 BATCH +${sentReference()} draft/multiline #test`, { window: '#test' });
      expect(mockSetAddMessage).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: 'first\nsecond', replyTo: 'm1' }));
    });

    it('sends each line as its own message without draft/multiline', () => {
      render(<Toolbar />);

      send('first\n\nsecond\n');

      expect(vi.mocked(network.ircSendCommand).mock.calls).toEqual([
        ['PRIVMSG #test :first', { window: '#test' }],
        ['PRIVMSG #test :second', { window: '#test' }],
      ]);
      expect(network.ircSendRawMessage).not.toHaveBeenCalled();
      expect(mockSetAddMessage.mock.calls.map(([message]) => (message as Message).message)).toEqual(['first', 'second']);
    });

    it('formats each line on its own', () => {
      mockStoreState({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: [],
          isConnected: true,
          isAutoAway: false,
          fontFormatting: { colorCode: null, bold: true, italic: false, underline: false },
          setFontFormatting: vi.fn(),
        });
      render(<Toolbar />);

      send('first\n\nsecond');

      expect(vi.mocked(network.ircSendCommand).mock.calls.map(([command]) => command)).toEqual([
        'PRIVMSG #test :\x02first\x02',
        'PRIVMSG #test :\x02second\x02',
      ]);
    });

    it('sends nothing for blank lines only and keeps them in the input', () => {
      render(<Toolbar />);

      send('\n\n');

      expect(network.ircSendCommand).not.toHaveBeenCalled();
      expect(screen.getByRole('textbox')).toHaveValue('\n\n');
    });

    it('moves through the lines with the arrows, and through the history from the first and last line', () => {
      render(<Toolbar />);
      send('earlier');
      const input = type('one\ntwo');

      input.setSelectionRange(5, 5);
      expect(fireEvent.keyDown(input, { key: 'ArrowUp' })).toBe(true);
      expect(input).toHaveValue('one\ntwo');

      input.setSelectionRange(1, 1);
      expect(fireEvent.keyDown(input, { key: 'ArrowDown' })).toBe(true);
      expect(input).toHaveValue('one\ntwo');

      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input).toHaveValue('earlier');

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(input).toHaveValue('one\ntwo');
    });

    it('completes the word on the line being typed', () => {
      vi.spyOn(users, 'useActiveUsers').mockImplementation((selector) =>
        selector({ users: [{ nick: 'alice', ident: 'alice', hostname: 'host', flags: [], channels: [{ name: '#test', flags: [], maxPermission: 0 }] }] })
      );
      render(<Toolbar />);
      const input = type('hello\nal');

      fireEvent.keyUp(input, { key: 'l' });
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(input).toHaveValue('hello\nalice ');
    });
  });
});
