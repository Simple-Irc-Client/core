import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WizardNick from '../WizardNick';
import * as settingsStore from '@features/settings/store/settings';
import * as resolveServerModule from '@shared/lib/resolveServerFromParams';
import * as network from '@/network/irc/network';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@features/settings/store/settings', () => ({
  setNick: vi.fn(),
  setWizardStep: vi.fn(),
  setServer: vi.fn(),
  setIsConnecting: vi.fn(),
}));

vi.mock('@/network/irc/network', () => ({
  ircConnect: vi.fn(),
}));

vi.mock('@shared/lib/resolveServerFromParams', () => ({
  resolveServerFromParams: vi.fn(() => undefined),
}));

describe('WizardNick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic rendering', () => {
    it('should render the title', () => {
      render(<WizardNick />);

      expect(screen.getByText('wizard.nick.title')).toBeInTheDocument();
    });

    it('should render the nick input field', () => {
      render(<WizardNick />);

      expect(screen.getByLabelText('wizard.nick.nick')).toBeInTheDocument();
    });

    it('should render the nick label', () => {
      render(<WizardNick />);

      expect(screen.getByText('wizard.nick.nick')).toBeInTheDocument();
    });

    it('should render the next button', () => {
      render(<WizardNick />);

      expect(screen.getByText('wizard.nick.button.next')).toBeInTheDocument();
    });

    it('should have empty input initially', () => {
      render(<WizardNick />);

      const input = screen.getByLabelText('wizard.nick.nick');
      expect(input).toHaveValue('');
    });

    it('should have autofocus on the nick input', () => {
      render(<WizardNick />);

      const input = screen.getByLabelText('wizard.nick.nick');
      expect(input).toHaveFocus();
    });
  });

  describe('Input behavior', () => {
    it('should update input value when typing', () => {
      render(<WizardNick />);

      const input = screen.getByLabelText('wizard.nick.nick');
      fireEvent.change(input, { target: { value: 'TestNick' } });

      expect(input).toHaveValue('TestNick');
    });

    it('should allow special characters in nick', () => {
      render(<WizardNick />);

      const input = screen.getByLabelText('wizard.nick.nick');
      fireEvent.change(input, { target: { value: 'Test_Nick123' } });

      expect(input).toHaveValue('Test_Nick123');
    });
  });

  describe('Button state', () => {
    it('should have disabled button when input is empty', () => {
      render(<WizardNick />);

      const button = screen.getByText('wizard.nick.button.next');
      expect(button).toBeDisabled();
    });

    it('should enable button when nick is entered', () => {
      render(<WizardNick />);

      const input = screen.getByLabelText('wizard.nick.nick');
      fireEvent.change(input, { target: { value: 'TestNick' } });

      const button = screen.getByText('wizard.nick.button.next');
      expect(button).not.toBeDisabled();
    });

    it('should disable button when nick is cleared', () => {
      render(<WizardNick />);

      const input = screen.getByLabelText('wizard.nick.nick');

      // Type a nick
      fireEvent.change(input, { target: { value: 'TestNick' } });
      expect(screen.getByText('wizard.nick.button.next')).not.toBeDisabled();

      // Clear the nick
      fireEvent.change(input, { target: { value: '' } });
      expect(screen.getByText('wizard.nick.button.next')).toBeDisabled();
    });
  });

  describe('Form submission', () => {
    it('should call setNick with entered nick when button is clicked', () => {
      render(<WizardNick />);

      const input = screen.getByLabelText('wizard.nick.nick');
      fireEvent.change(input, { target: { value: 'MyNickname' } });

      const button = screen.getByText('wizard.nick.button.next');
      fireEvent.click(button);

      expect(settingsStore.setNick).toHaveBeenCalledWith('MyNickname');
    });

    it('should call setWizardStep with "server" when button is clicked', () => {
      render(<WizardNick />);

      const input = screen.getByLabelText('wizard.nick.nick');
      fireEvent.change(input, { target: { value: 'MyNickname' } });

      const button = screen.getByText('wizard.nick.button.next');
      fireEvent.click(button);

      expect(settingsStore.setWizardStep).toHaveBeenCalledWith('server');
    });

    it('should call setNick when form is submitted via Enter key', () => {
      render(<WizardNick />);

      const input = screen.getByLabelText('wizard.nick.nick');
      fireEvent.change(input, { target: { value: 'MyNickname' } });

      const form = input.closest('form');
      if (!form) {
        throw new Error('Form not found');
      }
      fireEvent.submit(form);

      expect(settingsStore.setNick).toHaveBeenCalledWith('MyNickname');
    });

    it('should call setWizardStep when form is submitted via Enter key', () => {
      render(<WizardNick />);

      const input = screen.getByLabelText('wizard.nick.nick');
      fireEvent.change(input, { target: { value: 'MyNickname' } });

      const form = input.closest('form');
      if (!form) {
        throw new Error('Form not found');
      }
      fireEvent.submit(form);

      expect(settingsStore.setWizardStep).toHaveBeenCalledWith('server');
    });

    it('should not call setNick when nick is empty and button is clicked', () => {
      render(<WizardNick />);

      // Button is disabled, but let's verify the logic anyway
      const button = screen.getByText('wizard.nick.button.next');

      // Force click even though disabled
      fireEvent.click(button);

      expect(settingsStore.setNick).not.toHaveBeenCalled();
    });

    it('should not call setWizardStep when nick is empty', () => {
      render(<WizardNick />);

      const button = screen.getByText('wizard.nick.button.next');
      fireEvent.click(button);

      expect(settingsStore.setWizardStep).not.toHaveBeenCalled();
    });
  });

  describe('Input validation', () => {
    it('should have required attribute on input', () => {
      render(<WizardNick />);

      const input = screen.getByLabelText('wizard.nick.nick');
      expect(input).toBeRequired();
    });

    it('should have autocomplete attribute set to nick', () => {
      render(<WizardNick />);

      const input = screen.getByLabelText('wizard.nick.nick');
      expect(input).toHaveAttribute('autocomplete', 'nick');
    });
  });

  describe('Server query param', () => {
    it('should skip server step and connect directly when resolveServerFromParams returns a server', () => {
      const mockServer = { network: 'Libera.Chat', connectionType: 'backend' as const, default: 0, encoding: 'utf8', servers: ['irc.libera.chat'] };
      vi.mocked(resolveServerModule.resolveServerFromParams).mockReturnValue(mockServer);

      render(<WizardNick />);

      const input = screen.getByLabelText('wizard.nick.nick');
      fireEvent.change(input, { target: { value: 'MyNick' } });

      const button = screen.getByText('wizard.nick.button.next');
      fireEvent.click(button);

      expect(settingsStore.setServer).toHaveBeenCalledWith(mockServer);
      expect(network.ircConnect).toHaveBeenCalledWith(mockServer, 'MyNick');
      expect(settingsStore.setIsConnecting).toHaveBeenCalledWith(true);
      expect(settingsStore.setWizardStep).toHaveBeenCalledWith('loading');
    });

    it('should go to server step when resolveServerFromParams returns undefined', () => {
      vi.mocked(resolveServerModule.resolveServerFromParams).mockReturnValue(undefined);

      render(<WizardNick />);

      const input = screen.getByLabelText('wizard.nick.nick');
      fireEvent.change(input, { target: { value: 'MyNick' } });

      const button = screen.getByText('wizard.nick.button.next');
      fireEvent.click(button);

      expect(settingsStore.setServer).not.toHaveBeenCalled();
      expect(network.ircConnect).not.toHaveBeenCalled();
      expect(settingsStore.setWizardStep).toHaveBeenCalledWith('server');
    });
  });

  describe('Edge cases', () => {
    it('should handle whitespace-only nick', () => {
      render(<WizardNick />);

      const input = screen.getByLabelText('wizard.nick.nick');
      fireEvent.change(input, { target: { value: '   ' } });

      const button = screen.getByText('wizard.nick.button.next');
      // Button should be enabled since there are characters
      expect(button).not.toBeDisabled();

      fireEvent.click(button);
      // setNick will be called with whitespace (validation is on length, not content)
      expect(settingsStore.setNick).toHaveBeenCalledWith('   ');
    });

    it('should handle very long nick', () => {
      render(<WizardNick />);

      const longNick = 'a'.repeat(100);
      const input = screen.getByLabelText('wizard.nick.nick');
      fireEvent.change(input, { target: { value: longNick } });

      expect(input).toHaveValue(longNick);

      const button = screen.getByText('wizard.nick.button.next');
      fireEvent.click(button);

      expect(settingsStore.setNick).toHaveBeenCalledWith(longNick);
    });
  });
});
