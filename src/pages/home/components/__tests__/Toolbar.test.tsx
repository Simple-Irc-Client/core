import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Toolbar from '../Toolbar';
import * as settingsStore from '../../../../store/settings';
import * as network from '../../../../network/irc/network';
import * as users from '../../../../store/users';
import * as channelList from '../../../../store/channelList';
import { ChannelCategory } from '../../../../types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));

vi.mock('../../../../network/irc/network', () => ({
  ircSendRawMessage: vi.fn(),
}));

vi.mock('../../../../store/channels', () => ({
  setAddMessage: vi.fn(),
}));

let mockAwayMessages: unknown[] = [];

vi.mock('../../../../store/awayMessages', () => ({
  useAwayMessagesStore: (selector: (state: { messages: unknown[] }) => unknown) => selector({ messages: mockAwayMessages }),
}));

vi.mock('uuid', () => ({
  v4: () => 'test-uuid',
}));

vi.mock('emoji-picker-react', () => ({
  default: ({ onEmojiClick }: { onEmojiClick: (data: { emoji: string }) => void }) => (
    <div data-testid="emoji-picker">
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

    vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
      selector({
        currentChannelName: '#test',
        currentChannelCategory: ChannelCategory.channel,
        nick: 'testUser',
        currentUserFlags: [],
        isConnected: true,
      } as unknown as settingsStore.SettingsStore)
    );

    vi.spyOn(settingsStore, 'getCurrentNick').mockReturnValue('testUser');

    vi.spyOn(users, 'useUsersStore').mockImplementation((selector) =>
      selector({ users: [] } as unknown as ReturnType<typeof users.useUsersStore.getState>)
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

      const sendButton = screen.getByRole('button', { name: 'send' });
      expect(sendButton).toBeInTheDocument();
    });

    it('should not show send button when message is empty', () => {
      render(<Toolbar />);

      const sendButton = screen.queryByRole('button', { name: 'send' });
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

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('PRIVMSG #test :Hello world');
    });

    it('should clear input after submission', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hello world' } });

      const form = input.closest('form');
      fireEvent.submit(form as HTMLFormElement);

      expect(input).toHaveValue('');
    });

    it('should not send message when input is empty', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      const form = input.closest('form');
      fireEvent.submit(form as HTMLFormElement);

      expect(network.ircSendRawMessage).not.toHaveBeenCalledWith(expect.stringContaining('PRIVMSG'));
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
      vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
        selector({
          currentChannelName: 'Debug',
          currentChannelCategory: ChannelCategory.status,
          nick: 'testUser',
          currentUserFlags: [],
        } as unknown as settingsStore.SettingsStore)
      );

      render(<Toolbar />);

      const input = screen.queryByRole('textbox');
      expect(input).not.toBeInTheDocument();
    });
  });

  describe('Emoji picker', () => {
    it('should render the emoticons button', () => {
      render(<Toolbar />);

      const emoticonButton = screen.getByRole('button', { name: 'emoticons' });
      expect(emoticonButton).toBeInTheDocument();
    });

    it('should open emoji picker when clicking emoticons button', () => {
      render(<Toolbar />);

      const emoticonButton = screen.getByRole('button', { name: 'emoticons' });
      fireEvent.click(emoticonButton);

      const emojiPicker = screen.getByTestId('emoji-picker');
      expect(emojiPicker).toBeInTheDocument();
    });

    it('should insert emoji into message input when clicking an emoji', () => {
      render(<Toolbar />);

      const emoticonButton = screen.getByRole('button', { name: 'emoticons' });
      fireEvent.click(emoticonButton);

      const emojiButton = screen.getByTestId('emoji-grinning');
      fireEvent.click(emojiButton);

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('😀');
    });

    it('should append emoji to existing message', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hello ' } });

      const emoticonButton = screen.getByRole('button', { name: 'emoticons' });
      fireEvent.click(emoticonButton);

      const emojiButton = screen.getByTestId('emoji-heart');
      fireEvent.click(emojiButton);

      expect(input).toHaveValue('Hello ❤️');
    });

    it('should close emoji picker after selecting an emoji', () => {
      render(<Toolbar />);

      const emoticonButton = screen.getByRole('button', { name: 'emoticons' });
      fireEvent.click(emoticonButton);

      const emojiButton = screen.getByTestId('emoji-grinning');
      fireEvent.click(emojiButton);

      const emojiPicker = screen.queryByTestId('emoji-picker');
      expect(emojiPicker).not.toBeInTheDocument();
    });

    it('should allow sending message with emoji', () => {
      render(<Toolbar />);

      const emoticonButton = screen.getByRole('button', { name: 'emoticons' });
      fireEvent.click(emoticonButton);

      const emojiButton = screen.getByTestId('emoji-grinning');
      fireEvent.click(emojiButton);

      const input = screen.getByRole('textbox');
      const form = input.closest('form');
      fireEvent.submit(form as HTMLFormElement);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('PRIVMSG #test :😀');
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
      vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
        selector({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'lowercase',
          currentUserFlags: [],
        } as unknown as settingsStore.SettingsStore)
      );

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
      expect(document.body.textContent).toContain('main.toolbar.profileSettings');
    });

    it('should show Profile Settings option in menu', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeDefined();
      await user.click(avatarButton as HTMLElement);

      expect(document.body.textContent).toContain('main.toolbar.profileSettings');
    });

    it('should not show Away Messages option when no away messages', async () => {
      const user = userEvent.setup();
      render(<Toolbar />);

      const avatarButton = getAvatarButton();
      expect(avatarButton).toBeDefined();
      await user.click(avatarButton as HTMLElement);

      expect(document.body.textContent).not.toContain('main.toolbar.awayMessages');
    });

    it('should not show badge when no away messages', () => {
      render(<Toolbar />);

      // Badge should not be visible (no element with the badge class inside avatar)
      const avatarButton = getAvatarButton();
      const badge = avatarButton?.querySelector('.bg-red-500');
      expect(badge).not.toBeInTheDocument();
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

      expect(document.body.textContent).toContain('main.toolbar.awayMessages');
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

      vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
        selector({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: [],
          isAutoAway: false,
          isConnected: true,
          setIsAutoAway: mockSetIsAutoAway,
        } as unknown as settingsStore.SettingsStore)
      );

      // Mock getState to return the same mock functions
      vi.spyOn(settingsStore.useSettingsStore, 'getState').mockReturnValue({
        currentUserFlags: [],
        isConnected: true,
        setIsAutoAway: mockSetIsAutoAway,
      } as unknown as settingsStore.SettingsStore);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should send AWAY command after 15 minutes of inactivity', () => {
      render(<Toolbar />);

      // Fast forward 15 minutes
      vi.advanceTimersByTime(15 * 60 * 1000);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('AWAY :Auto away - inactive for 15 minutes');
      expect(mockSetIsAutoAway).toHaveBeenCalledWith(true);
    });

    it('should not send AWAY command before 15 minutes', () => {
      render(<Toolbar />);

      // Fast forward 14 minutes
      vi.advanceTimersByTime(14 * 60 * 1000);

      expect(network.ircSendRawMessage).not.toHaveBeenCalledWith('AWAY :Auto away - inactive for 15 minutes');
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
      expect(network.ircSendRawMessage).not.toHaveBeenCalledWith('AWAY :Auto away - inactive for 15 minutes');

      // Fast forward another 5 minutes (15 total since last message)
      vi.advanceTimersByTime(5 * 60 * 1000);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('AWAY :Auto away - inactive for 15 minutes');
    });

    it('should turn off auto-away when user sends a message', () => {
      // Set up as auto-away
      vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
        selector({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: ['away'],
          isAutoAway: true,
          isConnected: true,
          setIsAutoAway: mockSetIsAutoAway,
        } as unknown as settingsStore.SettingsStore)
      );

      vi.spyOn(settingsStore.useSettingsStore, 'getState').mockReturnValue({
        currentUserFlags: ['away'],
        isConnected: true,
        setIsAutoAway: mockSetIsAutoAway,
      } as unknown as settingsStore.SettingsStore);

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
      vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
        selector({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: ['away'],
          isAutoAway: false,
          isConnected: true,
          setIsAutoAway: mockSetIsAutoAway,
        } as unknown as settingsStore.SettingsStore)
      );

      vi.spyOn(settingsStore.useSettingsStore, 'getState').mockReturnValue({
        currentUserFlags: ['away'],
        isConnected: true,
        setIsAutoAway: mockSetIsAutoAway,
      } as unknown as settingsStore.SettingsStore);

      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hello' } });
      const form = input.closest('form');
      fireEvent.submit(form as HTMLFormElement);

      // Should NOT send AWAY command to turn it off
      expect(network.ircSendRawMessage).not.toHaveBeenCalledWith('AWAY');
    });

    it('should not set auto-away if already manually away', () => {
      vi.spyOn(settingsStore.useSettingsStore, 'getState').mockReturnValue({
        currentUserFlags: ['away'],
        isConnected: true,
        setIsAutoAway: mockSetIsAutoAway,
      } as unknown as settingsStore.SettingsStore);

      render(<Toolbar />);

      // Fast forward 15 minutes
      vi.advanceTimersByTime(15 * 60 * 1000);

      // Should not send AWAY command because user is already away
      expect(network.ircSendRawMessage).not.toHaveBeenCalledWith('AWAY :Auto away - inactive for 15 minutes');
    });

    it('should not set auto-away if not connected', () => {
      vi.spyOn(settingsStore.useSettingsStore, 'getState').mockReturnValue({
        currentUserFlags: [],
        isConnected: false,
        setIsAutoAway: mockSetIsAutoAway,
      } as unknown as settingsStore.SettingsStore);

      render(<Toolbar />);

      // Fast forward 15 minutes
      vi.advanceTimersByTime(15 * 60 * 1000);

      // Should not send AWAY command because not connected
      expect(network.ircSendRawMessage).not.toHaveBeenCalledWith('AWAY :Auto away - inactive for 15 minutes');
    });

    it('should not turn off auto-away if not connected', () => {
      // Set up as auto-away but not connected
      vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
        selector({
          currentChannelName: '#test',
          currentChannelCategory: ChannelCategory.channel,
          nick: 'testUser',
          currentUserFlags: ['away'],
          isAutoAway: true,
          isConnected: false,
          setIsAutoAway: mockSetIsAutoAway,
        } as unknown as settingsStore.SettingsStore)
      );

      vi.spyOn(settingsStore.useSettingsStore, 'getState').mockReturnValue({
        currentUserFlags: ['away'],
        isConnected: false,
        setIsAutoAway: mockSetIsAutoAway,
      } as unknown as settingsStore.SettingsStore);

      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Hello' } });
      const form = input.closest('form');
      fireEvent.submit(form as HTMLFormElement);

      // Should NOT send AWAY command because not connected
      expect(network.ircSendRawMessage).not.toHaveBeenCalledWith('AWAY');
    });
  });

  describe('Autocomplete commands', () => {
    it('should autocomplete command when pressing Tab after /', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '/jo' } });
      fireEvent.keyUp(input, { key: 'o' }); // Trigger keyUp to set autocompleteMessage
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(input).toHaveValue('/join');
    });

    it('should cycle through matching commands on multiple Tab presses', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '/a' } });
      fireEvent.keyUp(input, { key: 'a' });
      fireEvent.keyDown(input, { key: 'Tab' });

      expect(input).toHaveValue('/all');

      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('/amsg');

      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('/away');
    });

    it('should wrap around to first matching command after last match', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '/whe' } });
      fireEvent.keyUp(input, { key: 'e' });

      // First Tab - /whereis (only command starting with /whe)
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('/whereis');

      // Second Tab - wraps back to /whereis
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('/whereis');
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

      expect(input).toHaveValue('hello /join');
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

      expect(input).toHaveValue('#general');
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
      expect(input).toHaveValue('#help');

      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('#hello');

      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('#helpdesk');
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
      expect(input).toHaveValue('#alpha');

      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('#beta');

      // Wrap around
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('#alpha');
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

      expect(input).toHaveValue('/join #general');
    });
  });

  describe('Autocomplete users', () => {
    const mockUsersStore = (usersList: { nick: string; ident: string; hostname: string; flags: string[]; channels: { name: string; flags: string[]; maxPermission: number }[] }[]) => {
      vi.spyOn(users, 'useUsersStore').mockImplementation((selector) =>
        selector({ users: usersList } as unknown as ReturnType<typeof users.useUsersStore.getState>)
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

      expect(input).toHaveValue('alice');
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
      expect(input).toHaveValue('alex');

      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('alfred');

      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('alice');
    });

    it('should wrap around to first matching user after last match', () => {
      render(<Toolbar />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'b' } });
      fireEvent.keyUp(input, { key: 'b' });

      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('bob');

      // Wrap around (only one user matches 'b')
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('bob');
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

      expect(input).toHaveValue('hello alice');
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

      expect(input).toHaveValue('Alice');
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
      expect(input).toHaveValue('alex');

      // Type a new character - should reset
      fireEvent.change(input, { target: { value: 'bo' } });
      fireEvent.keyUp(input, { key: 'o' });
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue('bob');
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
});
