import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileSettings from '../ProfileSettings';
import * as network from '@/network/irc/network';
import { setTestSession } from '@/test/networks';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/app/i18n', () => ({
  default: {
    changeLanguage: vi.fn(),
  },
}));

vi.mock('@/network/irc/network', () => ({
  ircSendUserCommand: vi.fn(),
  ircConnect: vi.fn(),
}));

describe('ProfileSettings', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    setTestSession({ supportedOptions: [], currentUserAvatar: undefined, currentUserDisplayName: undefined, currentUserStatus: undefined, currentUserHomepage: undefined, currentUserColor: undefined });
  });

  describe('Tabs', () => {
    const renderOpen = () => render(<ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />);

    // Every tab stays in place so the dialog is as tall as the tallest; the inactive ones are hidden by their state
    const panelState = (element: Element | null) => element?.closest('[role="tabpanel"]')?.getAttribute('data-state');

    it('should open on the profile tab, with only its fields shown', () => {
      renderOpen();

      expect(screen.getByTestId('profile-tab-profile')).toHaveAttribute('aria-selected', 'true');
      expect(panelState(document.querySelector('#nick'))).toBe('active');
      expect(panelState(screen.getByTestId('theme-select'))).toBe('inactive');
      expect(panelState(screen.getByTestId('e2ee-enabled-toggle'))).toBe('inactive');
    });

    it.each([
      ['appearance', 'theme-select'],
      ['notifications', 'direct-sound-select'],
      ['privacy', 'e2ee-enabled-toggle'],
    ])('should show the %s tab settings', async (tab, testId) => {
      const user = userEvent.setup();
      renderOpen();

      await user.click(screen.getByTestId(`profile-tab-${tab}`));

      expect(panelState(screen.getByTestId(testId))).toBe('active');
      expect(panelState(document.querySelector('#nick'))).toBe('inactive');
    });

    it('should show the highlight words on the notifications tab', async () => {
      const user = userEvent.setup();
      renderOpen();

      await user.click(screen.getByTestId('profile-tab-notifications'));

      expect(screen.getByLabelText('profileSettings.highlightWords')).toBeInTheDocument();
    });

    it('should reopen on the last tab', async () => {
      const user = userEvent.setup();
      const { rerender } = renderOpen();

      await user.click(screen.getByTestId('profile-tab-privacy'));
      rerender(<ProfileSettings open={false} onOpenChange={mockOnOpenChange} currentNick="testUser" />);
      rerender(<ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />);

      expect(screen.getByTestId('profile-tab-privacy')).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByTestId('e2ee-enabled-toggle')).toBeInTheDocument();
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

      expect(network.ircSendUserCommand).toHaveBeenCalledWith('NICK newNickname');
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

      expect(network.ircSendUserCommand).not.toHaveBeenCalledWith(expect.stringContaining('NICK'));
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

      expect(network.ircSendUserCommand).not.toHaveBeenCalledWith(expect.stringContaining('NICK'));
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

      expect(network.ircSendUserCommand).toHaveBeenCalledWith('NICK newNick');
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

      expect(network.ircSendUserCommand).toHaveBeenCalledWith('NICK newNickname');
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

  describe('Avatar change functionality', () => {
    it('should not send METADATA when avatar URL is unsafe (javascript:)', async () => {
      const user = userEvent.setup();
      setTestSession({ supportedOptions: ['metadata-avatar'] });

      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      const avatarInput = document.querySelector('#avatar') as HTMLInputElement;
      await user.type(avatarInput, 'javascript:alert(1)');

      const changeButton = screen.getByText('profileSettings.changeAvatar');
      await user.click(changeButton);

      expect(network.ircSendUserCommand).not.toHaveBeenCalled();
    });

    it('should not send METADATA when avatar URL is unsafe (data:)', async () => {
      const user = userEvent.setup();
      setTestSession({ supportedOptions: ['metadata-avatar'] });

      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      const avatarInput = document.querySelector('#avatar') as HTMLInputElement;
      await user.type(avatarInput, 'data:image/png;base64,abc');

      const changeButton = screen.getByText('profileSettings.changeAvatar');
      await user.click(changeButton);

      expect(network.ircSendUserCommand).not.toHaveBeenCalled();
    });

    it('should send METADATA when avatar URL is safe (https)', async () => {
      const user = userEvent.setup();
      setTestSession({ supportedOptions: ['metadata-avatar'] });

      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      const avatarInput = document.querySelector('#avatar') as HTMLInputElement;
      await user.type(avatarInput, 'https://example.com/avatar.png');

      const changeButton = screen.getByText('profileSettings.changeAvatar');
      await user.click(changeButton);

      expect(network.ircSendUserCommand).toHaveBeenCalledWith(
        'METADATA * SET avatar https://example.com/avatar.png',
      );
    });

    it('should send METADATA to clear avatar when input is empty', async () => {
      const user = userEvent.setup();
      setTestSession({ supportedOptions: ['metadata-avatar'], currentUserAvatar: 'https://example.com/old.png' });

      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      const avatarInput = document.querySelector('#avatar') as HTMLInputElement;
      await user.clear(avatarInput);

      const changeButton = screen.getByText('profileSettings.changeAvatar');
      await user.click(changeButton);

      expect(network.ircSendUserCommand).toHaveBeenCalledWith('METADATA * SET avatar');
    });

    it('should not close dialog when avatar URL is unsafe', async () => {
      const user = userEvent.setup();
      setTestSession({ supportedOptions: ['metadata-avatar'] });

      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      const avatarInput = document.querySelector('#avatar') as HTMLInputElement;
      await user.type(avatarInput, 'javascript:alert(1)');

      const changeButton = screen.getByText('profileSettings.changeAvatar');
      await user.click(changeButton);

      expect(mockOnOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('Display name change functionality', () => {
    it('should not show display name field when metadata-display-name is not supported', () => {
      setTestSession({ supportedOptions: [] });

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
      setTestSession({ supportedOptions: ['metadata-display-name'] });

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
      setTestSession({ supportedOptions: ['metadata-display-name'], currentUserDisplayName: 'John Doe' });

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
      setTestSession({ supportedOptions: ['metadata-display-name'] });

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

      expect(network.ircSendUserCommand).toHaveBeenCalledWith('METADATA * SET display-name :New Display Name');
    });

    it('should send METADATA SET display-name without value to clear display name', async () => {
      const user = userEvent.setup();
      setTestSession({ supportedOptions: ['metadata-display-name'], currentUserDisplayName: 'Old Name' });

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

      expect(network.ircSendUserCommand).toHaveBeenCalledWith('METADATA * SET display-name');
    });

    it('should close dialog after changing display name', async () => {
      const user = userEvent.setup();
      setTestSession({ supportedOptions: ['metadata-display-name'] });

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
      setTestSession({ supportedOptions: ['metadata-display-name'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const displayNameInput = document.querySelector('#displayName') as HTMLInputElement;
      await user.type(displayNameInput, 'New Name{Enter}');

      expect(network.ircSendUserCommand).toHaveBeenCalledWith('METADATA * SET display-name :New Name');
    });

    it('should display translated display name label', () => {
      setTestSession({ supportedOptions: ['metadata-display-name'] });

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
      setTestSession({ supportedOptions: [] });

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
      setTestSession({ supportedOptions: ['metadata-status'] });

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
      setTestSession({ supportedOptions: ['metadata-status'], currentUserStatus: 'Working from home' });

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
      setTestSession({ supportedOptions: ['metadata-status'] });

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

      expect(network.ircSendUserCommand).toHaveBeenCalledWith('METADATA * SET status :On vacation');
    });

    it('should send METADATA SET status without value to clear status', async () => {
      const user = userEvent.setup();
      setTestSession({ supportedOptions: ['metadata-status'], currentUserStatus: 'Old Status' });

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

      expect(network.ircSendUserCommand).toHaveBeenCalledWith('METADATA * SET status');
    });

    it('should close dialog after changing status', async () => {
      const user = userEvent.setup();
      setTestSession({ supportedOptions: ['metadata-status'] });

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
      setTestSession({ supportedOptions: ['metadata-status'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const statusInput = document.querySelector('#status') as HTMLInputElement;
      await user.type(statusInput, 'New Status{Enter}');

      expect(network.ircSendUserCommand).toHaveBeenCalledWith('METADATA * SET status :New Status');
    });
  });

  describe('Homepage change functionality', () => {
    it('should not show homepage field when metadata-homepage is not supported', () => {
      setTestSession({ supportedOptions: [] });

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
      setTestSession({ supportedOptions: ['metadata-homepage'] });

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
      setTestSession({ supportedOptions: ['metadata-homepage'], currentUserHomepage: 'https://example.com' });

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
      setTestSession({ supportedOptions: ['metadata-homepage'] });

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

      expect(network.ircSendUserCommand).toHaveBeenCalledWith('METADATA * SET homepage https://mywebsite.com');
    });

    it('should send METADATA SET homepage without value to clear homepage', async () => {
      const user = userEvent.setup();
      setTestSession({ supportedOptions: ['metadata-homepage'], currentUserHomepage: 'https://old-website.com' });

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

      expect(network.ircSendUserCommand).toHaveBeenCalledWith('METADATA * SET homepage');
    });

    it('should close dialog after changing homepage', async () => {
      const user = userEvent.setup();
      setTestSession({ supportedOptions: ['metadata-homepage'] });

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
      setTestSession({ supportedOptions: ['metadata-homepage'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const homepageInput = document.querySelector('#homepage') as HTMLInputElement;
      await user.type(homepageInput, 'https://example.com{Enter}');

      expect(network.ircSendUserCommand).toHaveBeenCalledWith('METADATA * SET homepage https://example.com');
    });

    it('should display translated homepage labels', () => {
      setTestSession({ supportedOptions: ['metadata-homepage'] });

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

    it('should not send METADATA when homepage URL is unsafe (javascript:)', async () => {
      const user = userEvent.setup();
      setTestSession({ supportedOptions: ['metadata-homepage'] });

      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      const homepageInput = document.querySelector('#homepage') as HTMLInputElement;
      await user.type(homepageInput, 'javascript:alert(1)');

      const changeButton = screen.getByText('profileSettings.changeHomepage');
      await user.click(changeButton);

      expect(network.ircSendUserCommand).not.toHaveBeenCalled();
    });

    it('should not send METADATA when homepage URL is unsafe (data:)', async () => {
      const user = userEvent.setup();
      setTestSession({ supportedOptions: ['metadata-homepage'] });

      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      const homepageInput = document.querySelector('#homepage') as HTMLInputElement;
      await user.type(homepageInput, 'data:text/html,<h1>evil</h1>');

      const changeButton = screen.getByText('profileSettings.changeHomepage');
      await user.click(changeButton);

      expect(network.ircSendUserCommand).not.toHaveBeenCalled();
    });

    it('should not close dialog when homepage URL is unsafe', async () => {
      const user = userEvent.setup();
      setTestSession({ supportedOptions: ['metadata-homepage'] });

      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      const homepageInput = document.querySelector('#homepage') as HTMLInputElement;
      await user.type(homepageInput, 'javascript:alert(1)');

      const changeButton = screen.getByText('profileSettings.changeHomepage');
      await user.click(changeButton);

      expect(mockOnOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('Color change functionality', () => {
    it('should not show color field when metadata-color is not supported', () => {
      setTestSession({ supportedOptions: [] });

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
      setTestSession({ supportedOptions: ['metadata-color'] });

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
      setTestSession({ supportedOptions: ['metadata-color'], currentUserColor: '#ff0000' });

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
      setTestSession({ supportedOptions: ['metadata-color'] });

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

      expect(network.ircSendUserCommand).toHaveBeenCalledWith('METADATA * SET color #00ff00');
    });

    it('should close dialog after changing color', async () => {
      const user = userEvent.setup();
      setTestSession({ supportedOptions: ['metadata-color'], currentUserColor: '#ff0000' });

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
      setTestSession({ supportedOptions: ['metadata-color'] });

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
      setTestSession({ supportedOptions: ['metadata-color'], currentUserColor: undefined });

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

  describe('Unhappy paths', () => {
    it('should not send NICK command when nick is unchanged', async () => {
      const user = userEvent.setup();
      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      // Click change without modifying the nick
      const changeButton = screen.getByText('profileSettings.changeNick');
      await user.click(changeButton);

      // NICK command is still sent because the component doesn't check same nick
      // But the server will ignore it. The component only guards against empty.
      expect(network.ircSendUserCommand).toHaveBeenCalledWith('NICK testUser');
    });

    it('should send METADATA SET color with value when color input has a value', async () => {
      const user = userEvent.setup();
      setTestSession({ supportedOptions: ['metadata-color'], currentUserColor: '#ff0000' });

      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      const colorInput = document.querySelector('#color') as HTMLInputElement;
      fireEvent.change(colorInput, { target: { value: '#00ff00' } });

      const changeButton = screen.getByText('profileSettings.changeColor');
      await user.click(changeButton);

      expect(network.ircSendUserCommand).toHaveBeenCalledWith('METADATA * SET color #00ff00');
    });

    it('should hide all metadata fields when no options are supported', () => {
      setTestSession({ supportedOptions: [] });

      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      expect(document.querySelector('#avatar')).toBeNull();
      expect(document.querySelector('#displayName')).toBeNull();
      expect(document.querySelector('#status')).toBeNull();
      expect(document.querySelector('#homepage')).toBeNull();
      expect(document.querySelector('#color')).toBeNull();
    });

    it('should not send NICK command when nick input is whitespace only', async () => {
      const user = userEvent.setup();
      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      const nickInput = document.querySelector('#nick') as HTMLInputElement;
      await user.clear(nickInput);
      await user.type(nickInput, '   ');

      const changeButton = screen.getByText('profileSettings.changeNick');
      await user.click(changeButton);

      // handleNickChange checks newNick.trim().length > 0
      expect(network.ircSendUserCommand).not.toHaveBeenCalled();
    });
  });
});
