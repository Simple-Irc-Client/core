import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WizardPassword from '../WizardPassword';
import * as settingsStore from '@features/settings/store/settings';
import * as network from '@/network/irc/network';
import * as queryParams from '@shared/lib/queryParams';

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
  useSettingsStore: vi.fn(),
  getCurrentNick: vi.fn(),
}));

vi.mock('@shared/lib/queryParams', () => ({
  getChannelParam: vi.fn(() => undefined),
}));

describe('WizardPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMocks = (nick = 'TestNick') => {
    vi.mocked(settingsStore.useSettingsStore).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (selector: any) => selector({ nick })
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
});
