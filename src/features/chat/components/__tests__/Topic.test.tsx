import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Topic from '../Topic';
import * as ChannelsDrawerContext from '@/providers/ChannelsDrawerContext';
import * as currentStore from '@features/chat/store/current';
import * as settingsStore from '@features/settings/store/settings';
import * as usersStore from '@features/users/store/users';
import * as channelsStore from '@features/channels/store/channels';
import * as network from '@/network/irc/network';
import { IRC_FORMAT } from '@/shared/lib/ircFormatting';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === 'main.topic.setBy' && params) {
        return `Set by ${params.nick} on ${params.date}`;
      }
      return key;
    },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));

vi.mock('@shared/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span data-testid="tooltip-content">{children}</span>,
}));

vi.mock('@/network/irc/network', () => ({
  ircSendRawMessage: vi.fn(),
}));

vi.mock('@features/channels/store/channels', () => ({
  getTopicSetBy: vi.fn(() => ''),
  getTopicTime: vi.fn(() => 0),
}));

vi.mock('@/shared/lib/dateLocale', async () => {
  const { enUS } = await import('date-fns/locale');
  return { getDateFnsLocale: () => enUS };
});

describe('Topic', () => {
  const mockSetChannelsDrawerStatus = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMocks = (overrides: {
    topic?: string;
    currentChannelName?: string;
    userFlags?: string[];
  } = {}) => {
    const { topic = '', currentChannelName = '#test', userFlags = [] } = overrides;

    vi.spyOn(ChannelsDrawerContext, 'useChannelsDrawer').mockReturnValue({
      isChannelsDrawerOpen: false,
      setChannelsDrawerStatus: mockSetChannelsDrawerStatus,
    });

    vi.spyOn(currentStore, 'useCurrentStore').mockImplementation((selector) =>
      selector({ topic, messages: [], users: [], typing: [], setUpdateTopic: vi.fn(), setUpdateMessages: vi.fn(), setUpdateUsers: vi.fn(), setUpdateTyping: vi.fn(), setClearAll: vi.fn() })
    );

    vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
      selector({
        currentChannelName,
      } as unknown as settingsStore.SettingsStore)
    );

    vi.spyOn(usersStore, 'getCurrentUserChannelModes').mockReturnValue(userFlags);
  };

  describe('Basic rendering', () => {
    it('should render the topic input when user can edit', () => {
      setupMocks({ topic: 'Test Topic', userFlags: ['o'] });

      render(<Topic />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('Test Topic');
    });

    it('should render formatted topic text when user cannot edit', () => {
      setupMocks({ topic: 'Test Topic', userFlags: [] });

      render(<Topic />);

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByText('Test Topic')).toBeInTheDocument();
    });

    it('should render the menu button', () => {
      setupMocks();

      render(<Topic />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });

    it('should display empty topic when no topic is set and user can edit', () => {
      setupMocks({ topic: '', userFlags: ['o'] });

      render(<Topic />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('');
    });
  });

  describe('Edit permissions', () => {
    it('should show formatted text (no input) when user has no edit permissions', () => {
      setupMocks({ topic: 'Test Topic', userFlags: [] });

      render(<Topic />);

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByText('Test Topic')).toBeInTheDocument();
    });

    it('should show input when user has "o" (operator) flag', () => {
      setupMocks({ topic: 'Test Topic', userFlags: ['o'] });

      render(<Topic />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('should show input when user has "a" (admin) flag', () => {
      setupMocks({ topic: 'Test Topic', userFlags: ['a'] });

      render(<Topic />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('should show input when user has "q" (owner) flag', () => {
      setupMocks({ topic: 'Test Topic', userFlags: ['q'] });

      render(<Topic />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
    });

    it('should show formatted text (no input) when user only has "v" (voice) flag', () => {
      setupMocks({ topic: 'Test Topic', userFlags: ['v'] });

      render(<Topic />);

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByText('Test Topic')).toBeInTheDocument();
    });

    it('should show formatted text (no input) when user only has "h" (half-op) flag', () => {
      setupMocks({ topic: 'Test Topic', userFlags: ['h'] });

      render(<Topic />);

      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByText('Test Topic')).toBeInTheDocument();
    });
  });

  describe('Topic editing', () => {
    it('should update input value when typing', () => {
      setupMocks({ topic: 'Original Topic', userFlags: ['o'] });

      render(<Topic />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'New Topic' } });

      expect(input).toHaveValue('New Topic');
    });

    it('should show save button when topic is modified and user can edit', () => {
      setupMocks({ topic: 'Original Topic', userFlags: ['o'] });

      render(<Topic />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'New Topic' } });

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(3); // Menu button + Save button + Settings button
    });

    it('should not show save button when topic is unchanged', () => {
      setupMocks({ topic: 'Original Topic', userFlags: ['o'] });

      render(<Topic />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(2); // Menu button + Settings button (no save)
    });

    it('should not show save button when user cannot edit', () => {
      setupMocks({ topic: 'Original Topic', userFlags: [] });

      render(<Topic />);

      // Input is disabled, so we can't change it through fireEvent
      // The save button should not appear regardless

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(1); // Only menu button
    });
  });

  describe('Saving topic', () => {
    it('should send TOPIC command when save button is clicked', () => {
      setupMocks({ topic: 'Original Topic', currentChannelName: '#mychannel', userFlags: ['o'] });

      render(<Topic />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'New Topic' } });

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(3); // Menu + Save + Settings
      fireEvent.click(buttons[1] as HTMLElement); // Save button is second

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('TOPIC #mychannel :New Topic');
    });

    it('should send TOPIC command when Enter is pressed', () => {
      setupMocks({ topic: 'Original Topic', currentChannelName: '#mychannel', userFlags: ['o'] });

      render(<Topic />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'New Topic' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('TOPIC #mychannel :New Topic');
    });

    it('should not show input when user cannot edit (no keypress possible)', () => {
      setupMocks({ topic: 'Original Topic', currentChannelName: '#mychannel', userFlags: [] });

      render(<Topic />);

      // No input is rendered when user cannot edit
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(network.ircSendRawMessage).not.toHaveBeenCalled();
    });

    it('should not send TOPIC command when topic is unchanged', () => {
      setupMocks({ topic: 'Original Topic', currentChannelName: '#mychannel', userFlags: ['o'] });

      render(<Topic />);

      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(network.ircSendRawMessage).not.toHaveBeenCalled();
    });

    it('should not send TOPIC command on other key presses', () => {
      setupMocks({ topic: 'Original Topic', currentChannelName: '#mychannel', userFlags: ['o'] });

      render(<Topic />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'New Topic' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(network.ircSendRawMessage).not.toHaveBeenCalled();
    });
  });

  describe('Menu button', () => {
    it('should call setChannelsDrawerStatus when menu button is clicked', () => {
      setupMocks();

      render(<Topic />);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      fireEvent.click(buttons[0] as HTMLElement);

      expect(mockSetChannelsDrawerStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('Debug channel', () => {
    it('should not render input for Debug channel', () => {
      setupMocks({ currentChannelName: 'Debug' });

      render(<Topic />);

      const input = screen.queryByRole('textbox');
      expect(input).not.toBeInTheDocument();
    });

    it('should still render menu button for Debug channel', () => {
      setupMocks({ currentChannelName: 'Debug' });

      render(<Topic />);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
    });
  });

  describe('Status channel', () => {
    it('should not render input for Status channel', () => {
      setupMocks({ currentChannelName: 'Status' });

      render(<Topic />);

      const input = screen.queryByRole('textbox');
      expect(input).not.toBeInTheDocument();
    });

    it('should still render menu button for Debug channel', () => {
      setupMocks({ currentChannelName: 'Status' });

      render(<Topic />);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
    });
  });

  describe('Topic tooltip', () => {
    it('should render tooltip content when both nick and time are available', () => {
      setupMocks({ topic: 'Test Topic', userFlags: ['o'] });
      vi.mocked(channelsStore.getTopicSetBy).mockReturnValue('admin');
      vi.mocked(channelsStore.getTopicTime).mockReturnValue(1705579200); // 2024-01-18 12:00:00 UTC

      render(<Topic />);

      expect(screen.getByText(/Set by admin on/)).toBeInTheDocument();
    });

    it('should not render tooltip content when topicSetBy is empty', () => {
      setupMocks({ topic: 'Test Topic', userFlags: ['o'] });
      vi.mocked(channelsStore.getTopicSetBy).mockReturnValue('');
      vi.mocked(channelsStore.getTopicTime).mockReturnValue(1705579200);

      render(<Topic />);

      expect(screen.queryByText(/Set by/)).not.toBeInTheDocument();
    });

    it('should not render tooltip content when topicTime is 0', () => {
      setupMocks({ topic: 'Test Topic', userFlags: ['o'] });
      vi.mocked(channelsStore.getTopicSetBy).mockReturnValue('admin');
      vi.mocked(channelsStore.getTopicTime).mockReturnValue(0);

      render(<Topic />);

      expect(screen.queryByText(/Set by/)).not.toBeInTheDocument();
    });

    it('should not render tooltip content when both topicSetBy and topicTime are empty/zero', () => {
      setupMocks({ topic: 'Test Topic', userFlags: ['o'] });
      vi.mocked(channelsStore.getTopicSetBy).mockReturnValue('');
      vi.mocked(channelsStore.getTopicTime).mockReturnValue(0);

      render(<Topic />);

      expect(screen.queryByText(/Set by/)).not.toBeInTheDocument();
    });

    it('should format tooltip with date containing day, month and year', () => {
      setupMocks({ topic: 'Test Topic', userFlags: ['o'] });
      vi.mocked(channelsStore.getTopicSetBy).mockReturnValue('testuser');
      vi.mocked(channelsStore.getTopicTime).mockReturnValue(1705581000); // 18 Jan 2024

      render(<Topic />);

      const tooltipText = screen.getByText(/Set by testuser on/);
      expect(tooltipText).toBeInTheDocument();
      expect(tooltipText.textContent).toContain('18');
      expect(tooltipText.textContent).toContain('Jan');
      expect(tooltipText.textContent).toContain('2024');
    });

    it('should call getTopicSetBy and getTopicTime with correct channel name', () => {
      setupMocks({ topic: 'Test Topic', currentChannelName: '#mychannel', userFlags: ['o'] });
      vi.mocked(channelsStore.getTopicSetBy).mockReturnValue('');
      vi.mocked(channelsStore.getTopicTime).mockReturnValue(0);

      render(<Topic />);

      expect(channelsStore.getTopicSetBy).toHaveBeenCalledWith('#mychannel');
      expect(channelsStore.getTopicTime).toHaveBeenCalledWith('#mychannel');
    });
  });

  describe('IRC formatting in topic', () => {
    it('should render bold text with font-weight bold', () => {
      setupMocks({ topic: `${IRC_FORMAT.BOLD}bold topic${IRC_FORMAT.BOLD}`, userFlags: [] });

      const { container } = render(<Topic />);

      const boldSpan = container.querySelector('span[style*="font-weight"]');
      expect(boldSpan).toHaveStyle({ fontWeight: 'bold' });
      expect(boldSpan?.textContent).toBe('bold topic');
    });

    it('should render italic text with font-style italic', () => {
      setupMocks({ topic: `${IRC_FORMAT.ITALIC}italic topic${IRC_FORMAT.ITALIC}`, userFlags: [] });

      const { container } = render(<Topic />);

      const italicSpan = container.querySelector('span[style*="font-style"]');
      expect(italicSpan).toHaveStyle({ fontStyle: 'italic' });
    });

    it('should render underlined text', () => {
      setupMocks({ topic: `${IRC_FORMAT.UNDERLINE}underlined${IRC_FORMAT.UNDERLINE}`, userFlags: [] });

      const { container } = render(<Topic />);

      const underlineSpan = container.querySelector('span[style*="text-decoration"]');
      expect(underlineSpan).toHaveStyle({ textDecoration: 'underline' });
    });

    it('should render colored text with foreground color', () => {
      // Color code 4 is red (#FF0000)
      setupMocks({ topic: `${IRC_FORMAT.COLOR}4red topic`, userFlags: [] });

      const { container } = render(<Topic />);

      const coloredSpan = container.querySelector('span[style*="color"]');
      expect(coloredSpan).toHaveStyle({ color: '#FF0000' });
      expect(coloredSpan?.textContent).toBe('red topic');
    });

    it('should render text with background color', () => {
      // Color code 4,2 is red on blue
      setupMocks({ topic: `${IRC_FORMAT.COLOR}4,2colored bg`, userFlags: [] });

      const { container } = render(<Topic />);

      const coloredSpan = container.querySelector('span[style*="background-color"]');
      expect(coloredSpan).toHaveStyle({ backgroundColor: '#00007F' });
    });

    it('should render hex colored text', () => {
      setupMocks({ topic: `${IRC_FORMAT.HEX_COLOR}FF5500orange topic`, userFlags: [] });

      const { container } = render(<Topic />);

      const coloredSpan = container.querySelector('span[style*="color"]');
      expect(coloredSpan).toHaveStyle({ color: '#FF5500' });
    });

    it('should render monospace text', () => {
      setupMocks({ topic: `${IRC_FORMAT.MONOSPACE}code${IRC_FORMAT.MONOSPACE}`, userFlags: [] });

      const { container } = render(<Topic />);

      const monoSpan = container.querySelector('span[style*="font-family"]');
      expect(monoSpan).toHaveStyle({ fontFamily: 'monospace' });
    });

    it('should render strikethrough text', () => {
      setupMocks({ topic: `${IRC_FORMAT.STRIKETHROUGH}strike${IRC_FORMAT.STRIKETHROUGH}`, userFlags: [] });

      const { container } = render(<Topic />);

      const strikeSpan = container.querySelector('span[style*="text-decoration"]');
      expect(strikeSpan).toHaveStyle({ textDecoration: 'line-through' });
    });

    it('should handle combined formatting (bold + italic)', () => {
      setupMocks({ topic: `${IRC_FORMAT.BOLD}${IRC_FORMAT.ITALIC}bold+italic`, userFlags: [] });

      const { container } = render(<Topic />);

      const styledSpan = container.querySelector('span[style*="font-weight"]');
      expect(styledSpan).toHaveStyle({ fontWeight: 'bold', fontStyle: 'italic' });
    });

    it('should reset formatting after reset code', () => {
      setupMocks({ topic: `${IRC_FORMAT.BOLD}bold${IRC_FORMAT.RESET} normal`, userFlags: [] });

      const { container } = render(<Topic />);

      const boldSpan = container.querySelector('span[style*="font-weight"]');
      expect(boldSpan).toHaveStyle({ fontWeight: 'bold' });
      expect(boldSpan?.textContent).toBe('bold');

      // The entire text content should be preserved
      expect(container.textContent).toContain('bold');
      expect(container.textContent).toContain('normal');
    });

    it('should preserve text content when stripping formatting', () => {
      setupMocks({
        topic: `${IRC_FORMAT.BOLD}Hello${IRC_FORMAT.BOLD} ${IRC_FORMAT.COLOR}4World${IRC_FORMAT.COLOR}`,
        userFlags: [],
      });

      const { container } = render(<Topic />);

      expect(container.textContent).toContain('Hello');
      expect(container.textContent).toContain('World');
    });
  });
});
