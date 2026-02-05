import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

      expect(document.body.textContent).toContain('main.toolbar.profileSettings');
      expect(document.body.textContent).toContain('main.toolbar.profileDescription');
    });

    it('should not render dialog content when open is false', () => {
      render(
        <ProfileSettings
          open={false}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(document.body.textContent).not.toContain('main.toolbar.profileDescription');
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

      const changeButton = screen.getByText('main.toolbar.changeNick');
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

      const changeButton = screen.getByText('main.toolbar.changeNick');
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

      const changeButton = screen.getByText('main.toolbar.changeNick');
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

      const changeButton = screen.getByText('main.toolbar.changeNick');
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

      const changeButton = screen.getByText('main.toolbar.changeNick');
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

      expect(document.body.textContent).toContain('main.toolbar.layout');
      expect(document.body.textContent).toContain('main.toolbar.layoutClassic');
      expect(document.body.textContent).toContain('main.toolbar.layoutModern');
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

      expect(document.body.textContent).toContain('main.toolbar.hideAvatars');
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

      expect(document.body.textContent).toContain('main.toolbar.fontSize');
      expect(document.body.textContent).toContain('main.toolbar.fontSizeSmall');
      expect(document.body.textContent).toContain('main.toolbar.fontSizeMedium');
      expect(document.body.textContent).toContain('main.toolbar.fontSizeLarge');
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

      expect(screen.getByTestId('connect-button').textContent).toBe('main.toolbar.connect');
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

      const changeButton = screen.getByText('main.toolbar.changeDisplayName');
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

      const changeButton = screen.getByText('main.toolbar.changeDisplayName');
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

      const changeButton = screen.getByText('main.toolbar.changeDisplayName');
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

      expect(document.body.textContent).toContain('main.toolbar.displayName');
    });
  });
});
