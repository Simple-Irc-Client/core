import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WizardPassword from '../WizardPassword';
import * as settingsStore from '@features/settings/store/settings';
import * as network from '@/network/irc/network';
import * as queryParams from '@shared/lib/queryParams';
import * as encryption from '@/network/encryption';

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params) {
        return `${key} ${JSON.stringify(params)}`;
      }
      return key;
    },
  }),
}));

vi.mock('@/network/irc/network', () => ({
  ircSendPassword: vi.fn(),
  ircJoinChannels: vi.fn(),
}));

vi.mock('@features/settings/store/settings', () => ({
  setWizardStep: vi.fn(),
  setWizardCompleted: vi.fn(),
  setEncryptedPassword: vi.fn(),
  useSettingsStore: vi.fn(),
  getCurrentNick: vi.fn(),
}));

vi.mock('@/network/encryption', () => ({
  encryptPersistent: vi.fn().mockImplementation((str: string) => Promise.resolve(`encrypted:${str}`)),
  decryptPersistent: vi.fn().mockImplementation((str: string) => Promise.resolve(str.replace('encrypted:', ''))),
}));

vi.mock('@shared/lib/queryParams', () => ({
  getChannelParam: vi.fn(() => undefined),
}));

describe('WizardPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMocks = (nick = 'TestNick', opts?: { encryptedPassword?: string; passwordNick?: string }) => {
    vi.mocked(settingsStore.useSettingsStore).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (selector: any) => selector({
        nick,
        encryptedPassword: opts?.encryptedPassword,
        passwordNick: opts?.passwordNick,
      })
    );
    vi.mocked(settingsStore.getCurrentNick).mockReturnValue(nick);
  };

  describe('Basic rendering', () => {
    it('should render the title', () => {
      setupMocks();

      render(<WizardPassword />);

      expect(screen.getByText('wizard.password.title')).toBeInTheDocument();
    });

    it('should render the next button', () => {
      setupMocks();

      render(<WizardPassword />);

      expect(screen.getByText('wizard.password.button.next')).toBeInTheDocument();
    });

    it('should render password input when nick matches', () => {
      setupMocks('TestNick');

      render(<WizardPassword />);

      expect(screen.getByLabelText('wizard.password.password')).toBeInTheDocument();
    });

    it('should render password label when nick matches', () => {
      setupMocks('TestNick');

      render(<WizardPassword />);

      expect(screen.getByText('wizard.password.password')).toBeInTheDocument();
    });

    it('should have password type on input', () => {
      setupMocks();

      render(<WizardPassword />);

      const input = screen.getByLabelText('wizard.password.password');
      expect(input).toHaveAttribute('type', 'password');
    });

    it('should have autofocus on password input', () => {
      setupMocks();

      render(<WizardPassword />);

      const input = screen.getByLabelText('wizard.password.password');
      expect(input).toHaveFocus();
    });
  });

  describe('Nick timeout state', () => {
    it('should show timeout messages when nick changes', () => {
      // First render with initial nick
      setupMocks('InitialNick');
      const { rerender } = render(<WizardPassword />);

      // Change nick to trigger timeout state
      setupMocks('NewNick');
      rerender(<WizardPassword />);

      expect(screen.getByText('wizard.password.message.timeout1')).toBeInTheDocument();
      expect(screen.getByText('wizard.password.message.timeout2')).toBeInTheDocument();
      expect(screen.getByText(/wizard.password.message.timeout3/)).toBeInTheDocument();
      expect(screen.getByText('wizard.password.message.timeout4')).toBeInTheDocument();
    });

    it('should not show password input when nick changes', () => {
      setupMocks('InitialNick');
      const { rerender } = render(<WizardPassword />);

      setupMocks('NewNick');
      rerender(<WizardPassword />);

      expect(screen.queryByLabelText('wizard.password.password')).not.toBeInTheDocument();
    });

    it('should not show timeout messages when nick matches', () => {
      setupMocks('TestNick');

      render(<WizardPassword />);

      expect(screen.queryByText('wizard.password.message.timeout1')).not.toBeInTheDocument();
    });
  });

  describe('Button state', () => {
    it('should have disabled button when password is empty and nick matches', () => {
      setupMocks();

      render(<WizardPassword />);

      const button = screen.getByText('wizard.password.button.next');
      expect(button).toBeDisabled();
    });

    it('should enable button when password is entered', () => {
      setupMocks();

      render(<WizardPassword />);

      const input = screen.getByLabelText('wizard.password.password');
      fireEvent.change(input, { target: { value: 'mypassword' } });

      const button = screen.getByText('wizard.password.button.next');
      expect(button).not.toBeDisabled();
    });

    it('should enable button when nick has changed (timeout state)', () => {
      setupMocks('InitialNick');
      const { rerender } = render(<WizardPassword />);

      setupMocks('NewNick');
      rerender(<WizardPassword />);

      const button = screen.getByText('wizard.password.button.next');
      // Button should be enabled in timeout state (no password required)
      expect(button).not.toBeDisabled();
    });

    it('should disable button when password is cleared', () => {
      setupMocks();

      render(<WizardPassword />);

      const input = screen.getByLabelText('wizard.password.password');

      // Type a password
      fireEvent.change(input, { target: { value: 'mypassword' } });
      expect(screen.getByText('wizard.password.button.next')).not.toBeDisabled();

      // Clear the password
      fireEvent.change(input, { target: { value: '' } });
      expect(screen.getByText('wizard.password.button.next')).toBeDisabled();
    });
  });

  describe('Form submission - nick matches', () => {
    it('should call ircSendPassword with entered password when button is clicked', () => {
      setupMocks();

      render(<WizardPassword />);

      const input = screen.getByLabelText('wizard.password.password');
      fireEvent.change(input, { target: { value: 'secretpassword' } });

      const button = screen.getByText('wizard.password.button.next');
      fireEvent.click(button);

      expect(network.ircSendPassword).toHaveBeenCalledWith('secretpassword');
    });

    it('should call setWizardStep with "channels" when button is clicked', () => {
      setupMocks();

      render(<WizardPassword />);

      const input = screen.getByLabelText('wizard.password.password');
      fireEvent.change(input, { target: { value: 'secretpassword' } });

      const button = screen.getByText('wizard.password.button.next');
      fireEvent.click(button);

      expect(settingsStore.setWizardStep).toHaveBeenCalledWith('channels');
    });

    it('should call ircSendPassword when form is submitted via Enter key', () => {
      setupMocks();

      render(<WizardPassword />);

      const input = screen.getByLabelText('wizard.password.password');
      fireEvent.change(input, { target: { value: 'secretpassword' } });

      const form = input.closest('form');
      if (!form) {
        throw new Error('Form not found');
      }
      fireEvent.submit(form);

      expect(network.ircSendPassword).toHaveBeenCalledWith('secretpassword');
    });

    it('should call setWizardStep when form is submitted via Enter key', () => {
      setupMocks();

      render(<WizardPassword />);

      const input = screen.getByLabelText('wizard.password.password');
      fireEvent.change(input, { target: { value: 'secretpassword' } });

      const form = input.closest('form');
      if (!form) {
        throw new Error('Form not found');
      }
      fireEvent.submit(form);

      expect(settingsStore.setWizardStep).toHaveBeenCalledWith('channels');
    });
  });

  describe('Form submission - nick timeout', () => {
    it('should not call ircSendPassword when nick has changed', () => {
      setupMocks('InitialNick');
      const { rerender } = render(<WizardPassword />);

      setupMocks('NewNick');
      rerender(<WizardPassword />);

      const button = screen.getByText('wizard.password.button.next');
      fireEvent.click(button);

      expect(network.ircSendPassword).not.toHaveBeenCalled();
    });

    it('should still call setWizardStep when nick has changed', () => {
      setupMocks('InitialNick');
      const { rerender } = render(<WizardPassword />);

      setupMocks('NewNick');
      rerender(<WizardPassword />);

      const button = screen.getByText('wizard.password.button.next');
      fireEvent.click(button);

      expect(settingsStore.setWizardStep).toHaveBeenCalledWith('channels');
    });
  });

  describe('Input validation', () => {
    it('should have required attribute on password input', () => {
      setupMocks();

      render(<WizardPassword />);

      const input = screen.getByLabelText('wizard.password.password');
      expect(input).toBeRequired();
    });

    it('should have autocomplete attribute set to password', () => {
      setupMocks();

      render(<WizardPassword />);

      const input = screen.getByLabelText('wizard.password.password');
      expect(input).toHaveAttribute('autocomplete', 'password');
    });
  });

  describe('Channel query param', () => {
    it('should join channel and complete wizard when channel param exists', () => {
      setupMocks();
      vi.mocked(queryParams.getChannelParam).mockReturnValue(['#general']);

      render(<WizardPassword />);

      const input = screen.getByLabelText('wizard.password.password');
      fireEvent.change(input, { target: { value: 'secretpassword' } });

      const button = screen.getByText('wizard.password.button.next');
      fireEvent.click(button);

      expect(network.ircJoinChannels).toHaveBeenCalledWith(['#general']);
      expect(settingsStore.setWizardCompleted).toHaveBeenCalledWith(true);
      expect(settingsStore.setWizardStep).not.toHaveBeenCalled();
    });

    it('should join multiple channels when comma-separated', () => {
      setupMocks();
      vi.mocked(queryParams.getChannelParam).mockReturnValue(['#general', '#help']);

      render(<WizardPassword />);

      const input = screen.getByLabelText('wizard.password.password');
      fireEvent.change(input, { target: { value: 'secretpassword' } });

      const button = screen.getByText('wizard.password.button.next');
      fireEvent.click(button);

      expect(network.ircJoinChannels).toHaveBeenCalledWith(['#general', '#help']);
      expect(settingsStore.setWizardCompleted).toHaveBeenCalledWith(true);
    });

    it('should navigate to channels step when no channel param exists', () => {
      setupMocks();
      vi.mocked(queryParams.getChannelParam).mockReturnValue(undefined);

      render(<WizardPassword />);

      const input = screen.getByLabelText('wizard.password.password');
      fireEvent.change(input, { target: { value: 'secretpassword' } });

      const button = screen.getByText('wizard.password.button.next');
      fireEvent.click(button);

      expect(network.ircJoinChannels).not.toHaveBeenCalled();
      expect(settingsStore.setWizardCompleted).not.toHaveBeenCalled();
      expect(settingsStore.setWizardStep).toHaveBeenCalledWith('channels');
    });

    it('should join channel when nick has timed out', () => {
      setupMocks('InitialNick');
      vi.mocked(queryParams.getChannelParam).mockReturnValue(['#testing']);

      const { rerender } = render(<WizardPassword />);

      setupMocks('NewNick');
      rerender(<WizardPassword />);

      const button = screen.getByText('wizard.password.button.next');
      fireEvent.click(button);

      expect(network.ircSendPassword).not.toHaveBeenCalled();
      expect(network.ircJoinChannels).toHaveBeenCalledWith(['#testing']);
      expect(settingsStore.setWizardCompleted).toHaveBeenCalledWith(true);
    });
  });

  describe('Edge cases', () => {
    it('should not proceed when password is empty and button is disabled', () => {
      setupMocks();

      render(<WizardPassword />);

      // Button is disabled when password is empty
      const button = screen.getByText('wizard.password.button.next');
      expect(button).toBeDisabled();

      // Click on disabled button should not trigger handlers
      fireEvent.click(button);

      expect(network.ircSendPassword).not.toHaveBeenCalled();
      expect(settingsStore.setWizardStep).not.toHaveBeenCalled();
    });

    it('should handle password with special characters', () => {
      setupMocks();

      render(<WizardPassword />);

      const input = screen.getByLabelText('wizard.password.password');
      const specialPassword = 'P@$$w0rd!#%&*()';
      fireEvent.change(input, { target: { value: specialPassword } });

      const button = screen.getByText('wizard.password.button.next');
      fireEvent.click(button);

      expect(network.ircSendPassword).toHaveBeenCalledWith(specialPassword);
    });

    it('should handle very long password', () => {
      setupMocks();

      render(<WizardPassword />);

      const longPassword = 'a'.repeat(100);
      const input = screen.getByLabelText('wizard.password.password');
      fireEvent.change(input, { target: { value: longPassword } });

      const button = screen.getByText('wizard.password.button.next');
      fireEvent.click(button);

      expect(network.ircSendPassword).toHaveBeenCalledWith(longPassword);
    });
  });

  describe('Encrypted password persistence', () => {
    it('should encrypt and save password on submit when remember switch is on', async () => {
      setupMocks();

      render(<WizardPassword />);

      const input = screen.getByLabelText('wizard.password.password');
      fireEvent.change(input, { target: { value: 'secretpassword' } });

      // Switch defaults to off when no saved password, turn it on
      const rememberSwitch = screen.getByRole('switch');
      fireEvent.click(rememberSwitch);

      const button = screen.getByText('wizard.password.button.next');
      fireEvent.click(button);

      // Wait for the async encryptPersistent to resolve
      await vi.waitFor(() => {
        expect(encryption.encryptPersistent).toHaveBeenCalledWith('secretpassword');
        expect(settingsStore.setEncryptedPassword).toHaveBeenCalledWith('encrypted:secretpassword', 'TestNick');
      });
    });

    it('should not encrypt password when nick has changed (timeout state)', async () => {
      setupMocks('InitialNick');
      const { rerender } = render(<WizardPassword />);

      setupMocks('NewNick');
      rerender(<WizardPassword />);

      const button = screen.getByText('wizard.password.button.next');
      fireEvent.click(button);

      expect(encryption.encryptPersistent).not.toHaveBeenCalled();
      expect(settingsStore.setEncryptedPassword).not.toHaveBeenCalled();
    });

    it('should pre-fill password from saved encrypted password on mount', async () => {
      setupMocks('TestNick', { encryptedPassword: 'encrypted:savedpassword', passwordNick: 'TestNick' });

      render(<WizardPassword />);

      await vi.waitFor(() => {
        const input = screen.getByLabelText('wizard.password.password') as HTMLInputElement;
        expect(input.value).toBe('savedpassword');
      });
    });

    it('should not pre-fill password when passwordNick does not match current nick', async () => {
      setupMocks('TestNick', { encryptedPassword: 'encrypted:savedpassword', passwordNick: 'DifferentNick' });

      render(<WizardPassword />);

      // Give async decryptPersistent a chance to run (it shouldn't)
      await vi.waitFor(() => {
        expect(encryption.decryptPersistent).not.toHaveBeenCalled();
      });

      const input = screen.getByLabelText('wizard.password.password') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('should not pre-fill password when no encrypted password exists', () => {
      setupMocks('TestNick', { encryptedPassword: undefined, passwordNick: undefined });

      render(<WizardPassword />);

      expect(encryption.decryptPersistent).not.toHaveBeenCalled();
      const input = screen.getByLabelText('wizard.password.password') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('should handle decryption failure gracefully', async () => {
      vi.mocked(encryption.decryptPersistent).mockRejectedValueOnce(new Error('decrypt failed'));
      setupMocks('TestNick', { encryptedPassword: 'bad-data', passwordNick: 'TestNick' });

      render(<WizardPassword />);

      // Should not crash, password should remain empty
      await vi.waitFor(() => {
        expect(encryption.decryptPersistent).toHaveBeenCalled();
      });
      const input = screen.getByLabelText('wizard.password.password') as HTMLInputElement;
      expect(input.value).toBe('');
    });

    it('should enable submit button when password is pre-filled', async () => {
      setupMocks('TestNick', { encryptedPassword: 'encrypted:savedpassword', passwordNick: 'TestNick' });

      render(<WizardPassword />);

      await vi.waitFor(() => {
        const button = screen.getByText('wizard.password.button.next');
        expect(button).not.toBeDisabled();
      });
    });
  });

  describe('Remember password switch', () => {
    it('should show remember switch when nick matches', () => {
      setupMocks('TestNick');

      render(<WizardPassword />);

      expect(screen.getByRole('switch')).toBeInTheDocument();
      expect(screen.getByText('wizard.password.rememberPassword')).toBeInTheDocument();
    });

    it('should hide remember switch in timeout state', () => {
      setupMocks('InitialNick');
      const { rerender } = render(<WizardPassword />);

      setupMocks('NewNick');
      rerender(<WizardPassword />);

      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    });

    it('should default switch to on when saved password exists', () => {
      setupMocks('TestNick', { encryptedPassword: 'encrypted:savedpassword', passwordNick: 'TestNick' });

      render(<WizardPassword />);

      const rememberSwitch = screen.getByRole('switch');
      expect(rememberSwitch).toHaveAttribute('aria-checked', 'true');
    });

    it('should default switch to off when no saved password', () => {
      setupMocks('TestNick');

      render(<WizardPassword />);

      const rememberSwitch = screen.getByRole('switch');
      expect(rememberSwitch).toHaveAttribute('aria-checked', 'false');
    });

    it('should not save password when switch is off', () => {
      setupMocks();

      render(<WizardPassword />);

      const input = screen.getByLabelText('wizard.password.password');
      fireEvent.change(input, { target: { value: 'secretpassword' } });

      // Switch defaults to off, just submit
      const button = screen.getByText('wizard.password.button.next');
      fireEvent.click(button);

      expect(encryption.encryptPersistent).not.toHaveBeenCalled();
      expect(settingsStore.setEncryptedPassword).toHaveBeenCalledWith(undefined, undefined);
    });

    it('should clear saved password when switch is off and password was previously saved', () => {
      setupMocks('TestNick', { encryptedPassword: 'encrypted:savedpassword', passwordNick: 'TestNick' });

      render(<WizardPassword />);

      // Switch defaults to on because saved password exists, turn it off
      const rememberSwitch = screen.getByRole('switch');
      fireEvent.click(rememberSwitch);

      const input = screen.getByLabelText('wizard.password.password');
      fireEvent.change(input, { target: { value: 'savedpassword' } });

      const button = screen.getByText('wizard.password.button.next');
      fireEvent.click(button);

      expect(encryption.encryptPersistent).not.toHaveBeenCalled();
      expect(settingsStore.setEncryptedPassword).toHaveBeenCalledWith(undefined, undefined);
    });
  });
});
