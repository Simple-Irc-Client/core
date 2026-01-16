import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CreatorPassword from '../CreatorPassword';
import * as settingsStore from '../../../store/settings';
import * as network from '../../../network/irc/network';

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

vi.mock('../../../network/irc/network', () => ({
  ircSendPassword: vi.fn(),
}));

vi.mock('../../../store/settings', () => ({
  setCreatorStep: vi.fn(),
  useSettingsStore: vi.fn(),
  getCurrentNick: vi.fn(),
}));

describe('CreatorPassword', () => {
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

      render(<CreatorPassword />);

      expect(screen.getByText('creator.password.title')).toBeInTheDocument();
    });

    it('should render the next button', () => {
      setupMocks();

      render(<CreatorPassword />);

      expect(screen.getByText('creator.password.button.next')).toBeInTheDocument();
    });

    it('should render password input when nick matches', () => {
      setupMocks('TestNick');

      render(<CreatorPassword />);

      expect(screen.getByLabelText('creator.password.password')).toBeInTheDocument();
    });

    it('should render password label when nick matches', () => {
      setupMocks('TestNick');

      render(<CreatorPassword />);

      expect(screen.getByText('creator.password.password')).toBeInTheDocument();
    });

    it('should have password type on input', () => {
      setupMocks();

      render(<CreatorPassword />);

      const input = screen.getByLabelText('creator.password.password');
      expect(input).toHaveAttribute('type', 'password');
    });

    it('should have autofocus on password input', () => {
      setupMocks();

      render(<CreatorPassword />);

      const input = screen.getByLabelText('creator.password.password');
      expect(input).toHaveFocus();
    });
  });

  describe('Nick timeout state', () => {
    it('should show timeout messages when nick changes', () => {
      // First render with initial nick
      setupMocks('InitialNick');
      const { rerender } = render(<CreatorPassword />);

      // Change nick to trigger timeout state
      setupMocks('NewNick');
      rerender(<CreatorPassword />);

      expect(screen.getByText('creator.password.message.timeout1')).toBeInTheDocument();
      expect(screen.getByText('creator.password.message.timeout2')).toBeInTheDocument();
      expect(screen.getByText(/creator.password.message.timeout3/)).toBeInTheDocument();
      expect(screen.getByText('creator.password.message.timeout4')).toBeInTheDocument();
    });

    it('should not show password input when nick changes', () => {
      setupMocks('InitialNick');
      const { rerender } = render(<CreatorPassword />);

      setupMocks('NewNick');
      rerender(<CreatorPassword />);

      expect(screen.queryByLabelText('creator.password.password')).not.toBeInTheDocument();
    });

    it('should not show timeout messages when nick matches', () => {
      setupMocks('TestNick');

      render(<CreatorPassword />);

      expect(screen.queryByText('creator.password.message.timeout1')).not.toBeInTheDocument();
    });
  });

  describe('Button state', () => {
    it('should have disabled button when password is empty and nick matches', () => {
      setupMocks();

      render(<CreatorPassword />);

      const button = screen.getByText('creator.password.button.next');
      expect(button).toBeDisabled();
    });

    it('should enable button when password is entered', () => {
      setupMocks();

      render(<CreatorPassword />);

      const input = screen.getByLabelText('creator.password.password');
      fireEvent.change(input, { target: { value: 'mypassword' } });

      const button = screen.getByText('creator.password.button.next');
      expect(button).not.toBeDisabled();
    });

    it('should enable button when nick has changed (timeout state)', () => {
      setupMocks('InitialNick');
      const { rerender } = render(<CreatorPassword />);

      setupMocks('NewNick');
      rerender(<CreatorPassword />);

      const button = screen.getByText('creator.password.button.next');
      // Button should be enabled in timeout state (no password required)
      expect(button).not.toBeDisabled();
    });

    it('should disable button when password is cleared', () => {
      setupMocks();

      render(<CreatorPassword />);

      const input = screen.getByLabelText('creator.password.password');

      // Type a password
      fireEvent.change(input, { target: { value: 'mypassword' } });
      expect(screen.getByText('creator.password.button.next')).not.toBeDisabled();

      // Clear the password
      fireEvent.change(input, { target: { value: '' } });
      expect(screen.getByText('creator.password.button.next')).toBeDisabled();
    });
  });

  describe('Form submission - nick matches', () => {
    it('should call ircSendPassword with entered password when button is clicked', () => {
      setupMocks();

      render(<CreatorPassword />);

      const input = screen.getByLabelText('creator.password.password');
      fireEvent.change(input, { target: { value: 'secretpassword' } });

      const button = screen.getByText('creator.password.button.next');
      fireEvent.click(button);

      expect(network.ircSendPassword).toHaveBeenCalledWith('secretpassword');
    });

    it('should call setCreatorStep with "channels" when button is clicked', () => {
      setupMocks();

      render(<CreatorPassword />);

      const input = screen.getByLabelText('creator.password.password');
      fireEvent.change(input, { target: { value: 'secretpassword' } });

      const button = screen.getByText('creator.password.button.next');
      fireEvent.click(button);

      expect(settingsStore.setCreatorStep).toHaveBeenCalledWith('channels');
    });

    it('should call ircSendPassword when form is submitted via Enter key', () => {
      setupMocks();

      render(<CreatorPassword />);

      const input = screen.getByLabelText('creator.password.password');
      fireEvent.change(input, { target: { value: 'secretpassword' } });

      const form = input.closest('form');
      if (!form) {
        throw new Error('Form not found');
      }
      fireEvent.submit(form);

      expect(network.ircSendPassword).toHaveBeenCalledWith('secretpassword');
    });

    it('should call setCreatorStep when form is submitted via Enter key', () => {
      setupMocks();

      render(<CreatorPassword />);

      const input = screen.getByLabelText('creator.password.password');
      fireEvent.change(input, { target: { value: 'secretpassword' } });

      const form = input.closest('form');
      if (!form) {
        throw new Error('Form not found');
      }
      fireEvent.submit(form);

      expect(settingsStore.setCreatorStep).toHaveBeenCalledWith('channels');
    });
  });

  describe('Form submission - nick timeout', () => {
    it('should not call ircSendPassword when nick has changed', () => {
      setupMocks('InitialNick');
      const { rerender } = render(<CreatorPassword />);

      setupMocks('NewNick');
      rerender(<CreatorPassword />);

      const button = screen.getByText('creator.password.button.next');
      fireEvent.click(button);

      expect(network.ircSendPassword).not.toHaveBeenCalled();
    });

    it('should still call setCreatorStep when nick has changed', () => {
      setupMocks('InitialNick');
      const { rerender } = render(<CreatorPassword />);

      setupMocks('NewNick');
      rerender(<CreatorPassword />);

      const button = screen.getByText('creator.password.button.next');
      fireEvent.click(button);

      expect(settingsStore.setCreatorStep).toHaveBeenCalledWith('channels');
    });
  });

  describe('Input validation', () => {
    it('should have required attribute on password input', () => {
      setupMocks();

      render(<CreatorPassword />);

      const input = screen.getByLabelText('creator.password.password');
      expect(input).toBeRequired();
    });

    it('should have autocomplete attribute set to password', () => {
      setupMocks();

      render(<CreatorPassword />);

      const input = screen.getByLabelText('creator.password.password');
      expect(input).toHaveAttribute('autocomplete', 'password');
    });
  });

  describe('Edge cases', () => {
    it('should not proceed when password is empty and button is disabled', () => {
      setupMocks();

      render(<CreatorPassword />);

      // Button is disabled when password is empty
      const button = screen.getByText('creator.password.button.next');
      expect(button).toBeDisabled();

      // Click on disabled button should not trigger handlers
      fireEvent.click(button);

      expect(network.ircSendPassword).not.toHaveBeenCalled();
      expect(settingsStore.setCreatorStep).not.toHaveBeenCalled();
    });

    it('should handle password with special characters', () => {
      setupMocks();

      render(<CreatorPassword />);

      const input = screen.getByLabelText('creator.password.password');
      const specialPassword = 'P@$$w0rd!#%&*()';
      fireEvent.change(input, { target: { value: specialPassword } });

      const button = screen.getByText('creator.password.button.next');
      fireEvent.click(button);

      expect(network.ircSendPassword).toHaveBeenCalledWith(specialPassword);
    });

    it('should handle very long password', () => {
      setupMocks();

      render(<CreatorPassword />);

      const longPassword = 'a'.repeat(100);
      const input = screen.getByLabelText('creator.password.password');
      fireEvent.change(input, { target: { value: longPassword } });

      const button = screen.getByText('creator.password.button.next');
      fireEvent.click(button);

      expect(network.ircSendPassword).toHaveBeenCalledWith(longPassword);
    });
  });
});
