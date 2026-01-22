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
}));

describe('ProfileSettings', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      supportedOptions: [],
      currentUserAvatar: undefined,
      theme: 'modern',
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
});
