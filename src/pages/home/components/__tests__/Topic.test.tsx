import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Topic from '../Topic';
import * as ChannelsDrawerContext from '../../../../providers/ChannelsDrawerContext';
import * as currentStore from '../../../../store/current';
import * as settingsStore from '../../../../store/settings';
import * as usersStore from '../../../../store/users';
import * as network from '../../../../network/irc/network';

vi.mock('../../../../network/irc/network', () => ({
  ircSendRawMessage: vi.fn(),
}));

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
    it('should render the topic input', () => {
      setupMocks({ topic: 'Test Topic' });

      render(<Topic />);

      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('Test Topic');
    });

    it('should render the menu button', () => {
      setupMocks();

      render(<Topic />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });

    it('should display empty topic when no topic is set', () => {
      setupMocks({ topic: '' });

      render(<Topic />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveValue('');
    });
  });

  describe('Edit permissions', () => {
    it('should disable input when user has no edit permissions', () => {
      setupMocks({ topic: 'Test Topic', userFlags: [] });

      render(<Topic />);

      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });

    it('should enable input when user has "o" (operator) flag', () => {
      setupMocks({ topic: 'Test Topic', userFlags: ['o'] });

      render(<Topic />);

      const input = screen.getByRole('textbox');
      expect(input).not.toBeDisabled();
    });

    it('should enable input when user has "a" (admin) flag', () => {
      setupMocks({ topic: 'Test Topic', userFlags: ['a'] });

      render(<Topic />);

      const input = screen.getByRole('textbox');
      expect(input).not.toBeDisabled();
    });

    it('should enable input when user has "q" (owner) flag', () => {
      setupMocks({ topic: 'Test Topic', userFlags: ['q'] });

      render(<Topic />);

      const input = screen.getByRole('textbox');
      expect(input).not.toBeDisabled();
    });

    it('should disable input when user only has "v" (voice) flag', () => {
      setupMocks({ topic: 'Test Topic', userFlags: ['v'] });

      render(<Topic />);

      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });

    it('should disable input when user only has "h" (half-op) flag', () => {
      setupMocks({ topic: 'Test Topic', userFlags: ['h'] });

      render(<Topic />);

      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
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
      expect(buttons.length).toBe(2); // Menu button + Save button
    });

    it('should not show save button when topic is unchanged', () => {
      setupMocks({ topic: 'Original Topic', userFlags: ['o'] });

      render(<Topic />);

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(1); // Only menu button
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
      expect(buttons).toHaveLength(2);
      fireEvent.click(buttons[1] as HTMLElement);

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

    it('should not send TOPIC command when Enter is pressed but user cannot edit', () => {
      setupMocks({ topic: 'Original Topic', currentChannelName: '#mychannel', userFlags: [] });

      render(<Topic />);

      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Enter' });

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
});
