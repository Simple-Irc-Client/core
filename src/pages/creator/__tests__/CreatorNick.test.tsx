import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CreatorNick from '../CreatorNick';
import * as settingsStore from '../../../store/settings';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../../store/settings', () => ({
  setNick: vi.fn(),
  setCreatorStep: vi.fn(),
}));

describe('CreatorNick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic rendering', () => {
    it('should render the title', () => {
      render(<CreatorNick />);

      expect(screen.getByText('creator.nick.title')).toBeInTheDocument();
    });

    it('should render the nick input field', () => {
      render(<CreatorNick />);

      expect(screen.getByLabelText('creator.nick.nick')).toBeInTheDocument();
    });

    it('should render the nick label', () => {
      render(<CreatorNick />);

      expect(screen.getByText('creator.nick.nick')).toBeInTheDocument();
    });

    it('should render the next button', () => {
      render(<CreatorNick />);

      expect(screen.getByText('creator.nick.button.next')).toBeInTheDocument();
    });

    it('should have empty input initially', () => {
      render(<CreatorNick />);

      const input = screen.getByLabelText('creator.nick.nick');
      expect(input).toHaveValue('');
    });

    it('should have autofocus on the nick input', () => {
      render(<CreatorNick />);

      const input = screen.getByLabelText('creator.nick.nick');
      expect(input).toHaveFocus();
    });
  });

  describe('Input behavior', () => {
    it('should update input value when typing', () => {
      render(<CreatorNick />);

      const input = screen.getByLabelText('creator.nick.nick');
      fireEvent.change(input, { target: { value: 'TestNick' } });

      expect(input).toHaveValue('TestNick');
    });

    it('should allow special characters in nick', () => {
      render(<CreatorNick />);

      const input = screen.getByLabelText('creator.nick.nick');
      fireEvent.change(input, { target: { value: 'Test_Nick123' } });

      expect(input).toHaveValue('Test_Nick123');
    });
  });

  describe('Button state', () => {
    it('should have disabled button when input is empty', () => {
      render(<CreatorNick />);

      const button = screen.getByText('creator.nick.button.next');
      expect(button).toBeDisabled();
    });

    it('should enable button when nick is entered', () => {
      render(<CreatorNick />);

      const input = screen.getByLabelText('creator.nick.nick');
      fireEvent.change(input, { target: { value: 'TestNick' } });

      const button = screen.getByText('creator.nick.button.next');
      expect(button).not.toBeDisabled();
    });

    it('should disable button when nick is cleared', () => {
      render(<CreatorNick />);

      const input = screen.getByLabelText('creator.nick.nick');

      // Type a nick
      fireEvent.change(input, { target: { value: 'TestNick' } });
      expect(screen.getByText('creator.nick.button.next')).not.toBeDisabled();

      // Clear the nick
      fireEvent.change(input, { target: { value: '' } });
      expect(screen.getByText('creator.nick.button.next')).toBeDisabled();
    });
  });

  describe('Form submission', () => {
    it('should call setNick with entered nick when button is clicked', () => {
      render(<CreatorNick />);

      const input = screen.getByLabelText('creator.nick.nick');
      fireEvent.change(input, { target: { value: 'MyNickname' } });

      const button = screen.getByText('creator.nick.button.next');
      fireEvent.click(button);

      expect(settingsStore.setNick).toHaveBeenCalledWith('MyNickname');
    });

    it('should call setCreatorStep with "server" when button is clicked', () => {
      render(<CreatorNick />);

      const input = screen.getByLabelText('creator.nick.nick');
      fireEvent.change(input, { target: { value: 'MyNickname' } });

      const button = screen.getByText('creator.nick.button.next');
      fireEvent.click(button);

      expect(settingsStore.setCreatorStep).toHaveBeenCalledWith('server');
    });

    it('should call setNick when form is submitted via Enter key', () => {
      render(<CreatorNick />);

      const input = screen.getByLabelText('creator.nick.nick');
      fireEvent.change(input, { target: { value: 'MyNickname' } });

      const form = input.closest('form');
      if (!form) {
        throw new Error('Form not found');
      }
      fireEvent.submit(form);

      expect(settingsStore.setNick).toHaveBeenCalledWith('MyNickname');
    });

    it('should call setCreatorStep when form is submitted via Enter key', () => {
      render(<CreatorNick />);

      const input = screen.getByLabelText('creator.nick.nick');
      fireEvent.change(input, { target: { value: 'MyNickname' } });

      const form = input.closest('form');
      if (!form) {
        throw new Error('Form not found');
      }
      fireEvent.submit(form);

      expect(settingsStore.setCreatorStep).toHaveBeenCalledWith('server');
    });

    it('should not call setNick when nick is empty and button is clicked', () => {
      render(<CreatorNick />);

      // Button is disabled, but let's verify the logic anyway
      const button = screen.getByText('creator.nick.button.next');

      // Force click even though disabled
      fireEvent.click(button);

      expect(settingsStore.setNick).not.toHaveBeenCalled();
    });

    it('should not call setCreatorStep when nick is empty', () => {
      render(<CreatorNick />);

      const button = screen.getByText('creator.nick.button.next');
      fireEvent.click(button);

      expect(settingsStore.setCreatorStep).not.toHaveBeenCalled();
    });
  });

  describe('Input validation', () => {
    it('should have required attribute on input', () => {
      render(<CreatorNick />);

      const input = screen.getByLabelText('creator.nick.nick');
      expect(input).toBeRequired();
    });

    it('should have autocomplete attribute set to nick', () => {
      render(<CreatorNick />);

      const input = screen.getByLabelText('creator.nick.nick');
      expect(input).toHaveAttribute('autocomplete', 'nick');
    });
  });

  describe('Edge cases', () => {
    it('should handle whitespace-only nick', () => {
      render(<CreatorNick />);

      const input = screen.getByLabelText('creator.nick.nick');
      fireEvent.change(input, { target: { value: '   ' } });

      const button = screen.getByText('creator.nick.button.next');
      // Button should be enabled since there are characters
      expect(button).not.toBeDisabled();

      fireEvent.click(button);
      // setNick will be called with whitespace (validation is on length, not content)
      expect(settingsStore.setNick).toHaveBeenCalledWith('   ');
    });

    it('should handle very long nick', () => {
      render(<CreatorNick />);

      const longNick = 'a'.repeat(100);
      const input = screen.getByLabelText('creator.nick.nick');
      fireEvent.change(input, { target: { value: longNick } });

      expect(input).toHaveValue(longNick);

      const button = screen.getByText('creator.nick.button.next');
      fireEvent.click(button);

      expect(settingsStore.setNick).toHaveBeenCalledWith(longNick);
    });
  });
});
