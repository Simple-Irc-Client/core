import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

    vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
      selector({
        currentChannelName: '#test',
        currentChannelCategory: ChannelCategory.channel,
      } as unknown as settingsStore.SettingsStore)
    );

    vi.spyOn(settingsStore, 'getCurrentNick').mockReturnValue('testUser');

    vi.spyOn(users, 'getUsersFromChannelSortedByAZ').mockReturnValue([]);
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
});
