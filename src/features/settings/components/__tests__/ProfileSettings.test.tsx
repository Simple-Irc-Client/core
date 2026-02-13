import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileSettings from '../ProfileSettings';
import * as network from '@/network/irc/network';
import { useSettingsStore } from '@features/settings/store/settings';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/network/irc/network', () => ({
  ircSendRawMessage: vi.fn(),
  ircConnect: vi.fn(),
}));

describe('ProfileSettings', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      supportedOptions: [],
      currentUserAvatar: undefined,
      currentUserDisplayName: undefined,
      currentUserStatus: undefined,
      currentUserHomepage: undefined,
      currentUserColor: undefined,
      theme: 'modern',
      fontSize: 'medium',
      hideAvatarsInUsersList: false,
    });
  });

  describe('Dialog rendering', () => {
    it('should render dialog when open is true', () => {
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(document.body.textContent).toContain('profileSettings.title');
      expect(document.body.textContent).toContain('profileSettings.description');
    });

    it('should not render dialog content when open is false', () => {
      render(
        <ProfileSettings
          open={false}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(document.body.textContent).not.toContain('profileSettings.description');
    });

    it('should show nick input pre-filled with currentNick', () => {
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const nickInput = document.querySelector('#nick') as HTMLInputElement;
      expect(nickInput).not.toBeNull();
      expect(nickInput.value).toBe('testUser');
    });
  });

  describe('Nick change functionality', () => {
    it('should send NICK command when changing nickname', async () => {
      const user = userEvent.setup();
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const nickInput = document.querySelector('#nick') as HTMLInputElement;
      await user.clear(nickInput);
      await user.type(nickInput, 'newNickname');

      const changeButton = screen.getByText('profileSettings.changeNick');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('NICK newNickname');
    });

    it('should not send NICK command when nickname is empty', async () => {
      const user = userEvent.setup();
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const nickInput = document.querySelector('#nick') as HTMLInputElement;
      await user.clear(nickInput);

      const changeButton = screen.getByText('profileSettings.changeNick');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).not.toHaveBeenCalledWith(expect.stringContaining('NICK'));
    });

    it('should not send NICK command when nickname is only whitespace', async () => {
      const user = userEvent.setup();
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const nickInput = document.querySelector('#nick') as HTMLInputElement;
      await user.clear(nickInput);
      await user.type(nickInput, '   ');

      const changeButton = screen.getByText('profileSettings.changeNick');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).not.toHaveBeenCalledWith(expect.stringContaining('NICK'));
    });

    it('should trim whitespace from nickname', async () => {
      const user = userEvent.setup();
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const nickInput = document.querySelector('#nick') as HTMLInputElement;
      await user.clear(nickInput);
      await user.type(nickInput, '  newNick  ');

      const changeButton = screen.getByText('profileSettings.changeNick');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('NICK newNick');
    });

    it('should call onOpenChange(false) after changing nickname', async () => {
      const user = userEvent.setup();
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const nickInput = document.querySelector('#nick') as HTMLInputElement;
      await user.clear(nickInput);
      await user.type(nickInput, 'newNickname');

      const changeButton = screen.getByText('profileSettings.changeNick');
      await user.click(changeButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should send NICK command when pressing Enter in nick input', async () => {
      const user = userEvent.setup();
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const nickInput = document.querySelector('#nick') as HTMLInputElement;
      await user.clear(nickInput);
      await user.type(nickInput, 'newNickname{Enter}');

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('NICK newNickname');
    });
  });

  describe('Dialog state management', () => {
    it('should preserve nick input value when currentNick prop changes while open', () => {
      const { rerender } = render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="oldNick"
        />
      );

      let nickInput = document.querySelector('#nick') as HTMLInputElement;
      expect(nickInput.value).toBe('oldNick');

      // When currentNick changes while dialog is open, the input should preserve its value
      // to avoid overwriting any user edits
      rerender(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="newNick"
        />
      );

      nickInput = document.querySelector('#nick') as HTMLInputElement;
      expect(nickInput.value).toBe('oldNick');
    });

    it('should reset nick input when dialog is reopened', () => {
      const { rerender } = render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="firstNick"
        />
      );

      let nickInput = document.querySelector('#nick') as HTMLInputElement;
      expect(nickInput.value).toBe('firstNick');

      // Close the dialog
      rerender(
        <ProfileSettings
          open={false}
          onOpenChange={mockOnOpenChange}
          currentNick="newNick"
        />
      );

      // Reopen the dialog - should now have the new nick value
      rerender(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="newNick"
        />
      );

      nickInput = document.querySelector('#nick') as HTMLInputElement;
      expect(nickInput.value).toBe('newNick');
    });
  });

  describe('Layout switch functionality', () => {
    it('should render layout switch buttons', () => {
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(screen.getByTestId('layout-classic')).toBeInTheDocument();
      expect(screen.getByTestId('layout-modern')).toBeInTheDocument();
    });

    it('should show Modern as selected when theme is modern', () => {
      useSettingsStore.setState({ theme: 'modern' });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const modernButton = screen.getByTestId('layout-modern');
      const classicButton = screen.getByTestId('layout-classic');

      // Modern should have default variant (not outline)
      expect(modernButton).not.toHaveClass('border-input');
      expect(classicButton).toHaveClass('border-input');
    });

    it('should show Classic as selected when theme is classic', () => {
      useSettingsStore.setState({ theme: 'classic' });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const modernButton = screen.getByTestId('layout-modern');
      const classicButton = screen.getByTestId('layout-classic');

      // Classic should have default variant (not outline)
      expect(classicButton).not.toHaveClass('border-input');
      expect(modernButton).toHaveClass('border-input');
    });

    it('should switch to classic layout when Classic button is clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ theme: 'modern' });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const classicButton = screen.getByTestId('layout-classic');
      await user.click(classicButton);

      expect(useSettingsStore.getState().theme).toBe('classic');
    });

    it('should switch to modern layout when Modern button is clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ theme: 'classic' });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const modernButton = screen.getByTestId('layout-modern');
      await user.click(modernButton);

      expect(useSettingsStore.getState().theme).toBe('modern');
    });

    it('should display translated layout labels', () => {
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(document.body.textContent).toContain('profileSettings.layout');
      expect(document.body.textContent).toContain('profileSettings.layoutClassic');
      expect(document.body.textContent).toContain('profileSettings.layoutModern');
    });
  });

  describe('Hide avatars toggle', () => {
    it('should render hide avatars toggle', () => {
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(screen.getByTestId('hide-avatars-toggle')).toBeInTheDocument();
    });

    it('should display translated hide avatars label', () => {
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(document.body.textContent).toContain('profileSettings.hideAvatars');
    });

    it('should show unchecked state when hideAvatarsInUsersList is false', () => {
      useSettingsStore.setState({ hideAvatarsInUsersList: false });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const toggle = screen.getByTestId('hide-avatars-toggle');
      expect(toggle).toHaveAttribute('data-state', 'unchecked');
    });

    it('should show checked state when hideAvatarsInUsersList is true', () => {
      useSettingsStore.setState({ hideAvatarsInUsersList: true });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const toggle = screen.getByTestId('hide-avatars-toggle');
      expect(toggle).toHaveAttribute('data-state', 'checked');
    });

    it('should toggle hideAvatarsInUsersList when clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ hideAvatarsInUsersList: false });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const toggle = screen.getByTestId('hide-avatars-toggle');
      await user.click(toggle);

      expect(useSettingsStore.getState().hideAvatarsInUsersList).toBe(true);
    });

    it('should toggle hideAvatarsInUsersList from true to false when clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ hideAvatarsInUsersList: true });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const toggle = screen.getByTestId('hide-avatars-toggle');
      await user.click(toggle);

      expect(useSettingsStore.getState().hideAvatarsInUsersList).toBe(false);
    });
  });

  describe('Hide typing indicator toggle', () => {
    it('should render hide typing toggle', () => {
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(screen.getByTestId('hide-typing-toggle')).toBeInTheDocument();
    });

    it('should display translated hide typing label', () => {
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(document.body.textContent).toContain('profileSettings.hideTyping');
    });

    it('should show unchecked state when hideTypingIndicator is false', () => {
      useSettingsStore.setState({ hideTypingIndicator: false });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const toggle = screen.getByTestId('hide-typing-toggle');
      expect(toggle).toHaveAttribute('data-state', 'unchecked');
    });

    it('should show checked state when hideTypingIndicator is true', () => {
      useSettingsStore.setState({ hideTypingIndicator: true });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const toggle = screen.getByTestId('hide-typing-toggle');
      expect(toggle).toHaveAttribute('data-state', 'checked');
    });

    it('should toggle hideTypingIndicator when clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ hideTypingIndicator: false });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const toggle = screen.getByTestId('hide-typing-toggle');
      await user.click(toggle);

      expect(useSettingsStore.getState().hideTypingIndicator).toBe(true);
    });

    it('should toggle hideTypingIndicator from true to false when clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ hideTypingIndicator: true });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const toggle = screen.getByTestId('hide-typing-toggle');
      await user.click(toggle);

      expect(useSettingsStore.getState().hideTypingIndicator).toBe(false);
    });
  });

  describe('Font size picker', () => {
    it('should render font size buttons', () => {
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(screen.getByTestId('font-size-small')).toBeInTheDocument();
      expect(screen.getByTestId('font-size-medium')).toBeInTheDocument();
      expect(screen.getByTestId('font-size-large')).toBeInTheDocument();
    });

    it('should display translated font size labels', () => {
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(document.body.textContent).toContain('profileSettings.fontSize');
      expect(document.body.textContent).toContain('profileSettings.fontSizeSmall');
      expect(document.body.textContent).toContain('profileSettings.fontSizeMedium');
      expect(document.body.textContent).toContain('profileSettings.fontSizeLarge');
    });

    it('should show Medium as selected when fontSize is medium', () => {
      useSettingsStore.setState({ fontSize: 'medium' });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const smallButton = screen.getByTestId('font-size-small');
      const mediumButton = screen.getByTestId('font-size-medium');
      const largeButton = screen.getByTestId('font-size-large');

      // Medium should have default variant (not outline)
      expect(mediumButton).not.toHaveClass('border-input');
      expect(smallButton).toHaveClass('border-input');
      expect(largeButton).toHaveClass('border-input');
    });

    it('should show Small as selected when fontSize is small', () => {
      useSettingsStore.setState({ fontSize: 'small' });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const smallButton = screen.getByTestId('font-size-small');
      const mediumButton = screen.getByTestId('font-size-medium');
      const largeButton = screen.getByTestId('font-size-large');

      // Small should have default variant (not outline)
      expect(smallButton).not.toHaveClass('border-input');
      expect(mediumButton).toHaveClass('border-input');
      expect(largeButton).toHaveClass('border-input');
    });

    it('should show Large as selected when fontSize is large', () => {
      useSettingsStore.setState({ fontSize: 'large' });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const smallButton = screen.getByTestId('font-size-small');
      const mediumButton = screen.getByTestId('font-size-medium');
      const largeButton = screen.getByTestId('font-size-large');

      // Large should have default variant (not outline)
      expect(largeButton).not.toHaveClass('border-input');
      expect(smallButton).toHaveClass('border-input');
      expect(mediumButton).toHaveClass('border-input');
    });

    it('should switch to small font size when Small button is clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ fontSize: 'medium' });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const smallButton = screen.getByTestId('font-size-small');
      await user.click(smallButton);

      expect(useSettingsStore.getState().fontSize).toBe('small');
    });

    it('should switch to medium font size when Medium button is clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ fontSize: 'small' });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const mediumButton = screen.getByTestId('font-size-medium');
      await user.click(mediumButton);

      expect(useSettingsStore.getState().fontSize).toBe('medium');
    });

    it('should switch to large font size when Large button is clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ fontSize: 'medium' });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const largeButton = screen.getByTestId('font-size-large');
      await user.click(largeButton);

      expect(useSettingsStore.getState().fontSize).toBe('large');
    });
  });

  describe('Connect button', () => {
    const mockServer = {
      default: 0,
      encoding: 'utf8',
      network: 'TestNet',
      servers: ['irc.test.net:6667'],
    };

    it('should show Connect button when disconnected and server/nick are available', () => {
      useSettingsStore.setState({
        isConnected: false,
        server: mockServer,
        nick: 'testUser',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(screen.getByTestId('connect-button')).toBeInTheDocument();
    });

    it('should not show Connect button when connected', () => {
      useSettingsStore.setState({
        isConnected: true,
        server: mockServer,
        nick: 'testUser',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(screen.queryByTestId('connect-button')).not.toBeInTheDocument();
    });

    it('should not show Connect button when server is undefined', () => {
      useSettingsStore.setState({
        isConnected: false,
        server: undefined,
        nick: 'testUser',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(screen.queryByTestId('connect-button')).not.toBeInTheDocument();
    });

    it('should not show Connect button when nick is empty', () => {
      useSettingsStore.setState({
        isConnected: false,
        server: mockServer,
        nick: '',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(screen.queryByTestId('connect-button')).not.toBeInTheDocument();
    });

    it('should call ircConnect when Connect button is clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({
        isConnected: false,
        server: mockServer,
        nick: 'testUser',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const connectButton = screen.getByTestId('connect-button');
      await user.click(connectButton);

      expect(network.ircConnect).toHaveBeenCalledWith(mockServer, 'testUser');
    });

    it('should close dialog after clicking Connect button', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({
        isConnected: false,
        server: mockServer,
        nick: 'testUser',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const connectButton = screen.getByTestId('connect-button');
      await user.click(connectButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should display translated Connect label', () => {
      useSettingsStore.setState({
        isConnected: false,
        server: mockServer,
        nick: 'testUser',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(screen.getByTestId('connect-button').textContent).toBe('currentUser.connect');
    });
  });

  describe('Display name change functionality', () => {
    it('should not show display name field when metadata-display-name is not supported', () => {
      useSettingsStore.setState({ supportedOptions: [] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const displayNameInput = document.querySelector('#displayName');
      expect(displayNameInput).toBeNull();
    });

    it('should show display name field when metadata-display-name is supported', () => {
      useSettingsStore.setState({ supportedOptions: ['metadata-display-name'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const displayNameInput = document.querySelector('#displayName');
      expect(displayNameInput).not.toBeNull();
    });

    it('should pre-fill display name input with current display name', () => {
      useSettingsStore.setState({
        supportedOptions: ['metadata-display-name'],
        currentUserDisplayName: 'John Doe',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const displayNameInput = document.querySelector('#displayName') as HTMLInputElement;
      expect(displayNameInput.value).toBe('John Doe');
    });

    it('should send METADATA SET display-name command when changing display name', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-display-name'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const displayNameInput = document.querySelector('#displayName') as HTMLInputElement;
      await user.type(displayNameInput, 'New Display Name');

      const changeButton = screen.getByText('profileSettings.changeDisplayName');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA * SET display-name :New Display Name');
    });

    it('should send METADATA SET display-name without value to clear display name', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({
        supportedOptions: ['metadata-display-name'],
        currentUserDisplayName: 'Old Name',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const displayNameInput = document.querySelector('#displayName') as HTMLInputElement;
      await user.clear(displayNameInput);

      const changeButton = screen.getByText('profileSettings.changeDisplayName');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA * SET display-name');
    });

    it('should close dialog after changing display name', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-display-name'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const displayNameInput = document.querySelector('#displayName') as HTMLInputElement;
      await user.type(displayNameInput, 'New Display Name');

      const changeButton = screen.getByText('profileSettings.changeDisplayName');
      await user.click(changeButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should send METADATA SET display-name command when pressing Enter', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-display-name'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const displayNameInput = document.querySelector('#displayName') as HTMLInputElement;
      await user.type(displayNameInput, 'New Name{Enter}');

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA * SET display-name :New Name');
    });

    it('should display translated display name label', () => {
      useSettingsStore.setState({ supportedOptions: ['metadata-display-name'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(document.body.textContent).toContain('profileSettings.displayName');
    });
  });

  describe('Status change functionality', () => {
    it('should not show status field when metadata-status is not supported', () => {
      useSettingsStore.setState({ supportedOptions: [] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const statusInput = document.querySelector('#status');
      expect(statusInput).toBeNull();
    });

    it('should show status field when metadata-status is supported', () => {
      useSettingsStore.setState({ supportedOptions: ['metadata-status'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const statusInput = document.querySelector('#status');
      expect(statusInput).not.toBeNull();
    });

    it('should pre-fill status input with current status', () => {
      useSettingsStore.setState({
        supportedOptions: ['metadata-status'],
        currentUserStatus: 'Working from home',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const statusInput = document.querySelector('#status') as HTMLInputElement;
      expect(statusInput.value).toBe('Working from home');
    });

    it('should send METADATA SET status command when changing status', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-status'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const statusInput = document.querySelector('#status') as HTMLInputElement;
      await user.type(statusInput, 'On vacation');

      const changeButton = screen.getByText('profileSettings.changeStatus');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA * SET status :On vacation');
    });

    it('should send METADATA SET status without value to clear status', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({
        supportedOptions: ['metadata-status'],
        currentUserStatus: 'Old Status',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const statusInput = document.querySelector('#status') as HTMLInputElement;
      await user.clear(statusInput);

      const changeButton = screen.getByText('profileSettings.changeStatus');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA * SET status');
    });

    it('should close dialog after changing status', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-status'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const statusInput = document.querySelector('#status') as HTMLInputElement;
      await user.type(statusInput, 'New Status');

      const changeButton = screen.getByText('profileSettings.changeStatus');
      await user.click(changeButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should send METADATA SET status command when pressing Enter', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-status'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const statusInput = document.querySelector('#status') as HTMLInputElement;
      await user.type(statusInput, 'New Status{Enter}');

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA * SET status :New Status');
    });
  });

  describe('Homepage change functionality', () => {
    it('should not show homepage field when metadata-homepage is not supported', () => {
      useSettingsStore.setState({ supportedOptions: [] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const homepageInput = document.querySelector('#homepage');
      expect(homepageInput).toBeNull();
    });

    it('should show homepage field when metadata-homepage is supported', () => {
      useSettingsStore.setState({ supportedOptions: ['metadata-homepage'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const homepageInput = document.querySelector('#homepage');
      expect(homepageInput).not.toBeNull();
    });

    it('should pre-fill homepage input with current homepage', () => {
      useSettingsStore.setState({
        supportedOptions: ['metadata-homepage'],
        currentUserHomepage: 'https://example.com',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const homepageInput = document.querySelector('#homepage') as HTMLInputElement;
      expect(homepageInput.value).toBe('https://example.com');
    });

    it('should send METADATA SET homepage command when changing homepage', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-homepage'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const homepageInput = document.querySelector('#homepage') as HTMLInputElement;
      await user.type(homepageInput, 'https://mywebsite.com');

      const changeButton = screen.getByText('profileSettings.changeHomepage');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA * SET homepage https://mywebsite.com');
    });

    it('should send METADATA SET homepage without value to clear homepage', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({
        supportedOptions: ['metadata-homepage'],
        currentUserHomepage: 'https://old-website.com',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const homepageInput = document.querySelector('#homepage') as HTMLInputElement;
      await user.clear(homepageInput);

      const changeButton = screen.getByText('profileSettings.changeHomepage');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA * SET homepage');
    });

    it('should close dialog after changing homepage', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-homepage'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const homepageInput = document.querySelector('#homepage') as HTMLInputElement;
      await user.type(homepageInput, 'https://example.com');

      const changeButton = screen.getByText('profileSettings.changeHomepage');
      await user.click(changeButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should send METADATA SET homepage command when pressing Enter', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-homepage'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const homepageInput = document.querySelector('#homepage') as HTMLInputElement;
      await user.type(homepageInput, 'https://example.com{Enter}');

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA * SET homepage https://example.com');
    });

    it('should display translated homepage labels', () => {
      useSettingsStore.setState({ supportedOptions: ['metadata-homepage'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(document.body.textContent).toContain('profileSettings.homepage');
      expect(document.body.textContent).toContain('profileSettings.changeHomepage');
    });
  });

  describe('Color change functionality', () => {
    it('should not show color field when metadata-color is not supported', () => {
      useSettingsStore.setState({ supportedOptions: [] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const colorInput = document.querySelector('#color');
      expect(colorInput).toBeNull();
    });

    it('should show color field when metadata-color is supported', () => {
      useSettingsStore.setState({ supportedOptions: ['metadata-color'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const colorInput = document.querySelector('#color');
      expect(colorInput).not.toBeNull();
    });

    it('should pre-fill color input with current color', () => {
      useSettingsStore.setState({
        supportedOptions: ['metadata-color'],
        currentUserColor: '#ff0000',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const colorInput = document.querySelector('#color') as HTMLInputElement;
      expect(colorInput.value).toBe('#ff0000');
    });

    it('should send METADATA SET color command when changing color', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-color'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const colorInput = document.querySelector('#color') as HTMLInputElement;
      // Simulate color input change using fireEvent for color inputs
      fireEvent.change(colorInput, { target: { value: '#00ff00' } });

      const changeButton = screen.getByText('profileSettings.changeColor');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA * SET color #00ff00');
    });

    it('should close dialog after changing color', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({
        supportedOptions: ['metadata-color'],
        currentUserColor: '#ff0000',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const changeButton = screen.getByText('profileSettings.changeColor');
      await user.click(changeButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should display translated color labels', () => {
      useSettingsStore.setState({ supportedOptions: ['metadata-color'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(document.body.textContent).toContain('profileSettings.nickColor');
      expect(document.body.textContent).toContain('profileSettings.changeColor');
    });

    it('should default to black color when no color is set', () => {
      useSettingsStore.setState({
        supportedOptions: ['metadata-color'],
        currentUserColor: undefined,
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const colorInput = document.querySelector('#color') as HTMLInputElement;
      expect(colorInput.value).toBe('#000000');
    });
  });
});
