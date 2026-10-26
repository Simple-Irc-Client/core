import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileTab from '../tabs/ProfileTab';
import { useSettingsStore } from '@features/settings/store/settings';
import { setTestSession } from '@/test/networks';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { minutes?: number }) => (options?.minutes === undefined ? key : `${key}:${options.minutes}`),
  }),
}));

vi.mock('@/network/irc/network', () => ({
  ircSendUserCommand: vi.fn(),
}));

// Radix Select needs pointer-capture APIs and scrollIntoView, which jsdom lacks
beforeAll(() => {
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.setPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('ProfileTab', () => {
  beforeEach(() => {
    useSettingsStore.setState({ autoAwayMinutes: 15, autoAwayMessage: '' });
    setTestSession({ supportedOptions: [] });
  });

  describe('Auto away', () => {
    it('should set the user away after 15 minutes by default, and change it', async () => {
      const user = userEvent.setup();
      render(<ProfileTab currentNick="me" onDone={vi.fn()} />);

      expect(screen.getByTestId('auto-away-select')).toHaveTextContent('profileSettings.autoAwayAfter:15');

      await user.click(screen.getByTestId('auto-away-select'));
      await user.click(screen.getByRole('option', { name: 'profileSettings.autoAwayAfter:5' }));

      expect(useSettingsStore.getState().autoAwayMinutes).toBe(5);
    });

    it('should turn it off, and hide the message then', async () => {
      const user = userEvent.setup();
      render(<ProfileTab currentNick="me" onDone={vi.fn()} />);
      expect(screen.getByLabelText('profileSettings.autoAwayMessage')).toBeInTheDocument();

      await user.click(screen.getByTestId('auto-away-select'));
      await user.click(screen.getByRole('option', { name: 'profileSettings.autoAwayOff' }));

      expect(useSettingsStore.getState().autoAwayMinutes).toBe(0);
      expect(screen.queryByLabelText('profileSettings.autoAwayMessage')).not.toBeInTheDocument();
    });

    it('should keep the user\'s own away message, showing the default one until there is one', async () => {
      const user = userEvent.setup();
      render(<ProfileTab currentNick="me" onDone={vi.fn()} />);
      const message = screen.getByLabelText('profileSettings.autoAwayMessage');
      expect(message).toHaveAttribute('placeholder', 'currentUser.autoAway:15');

      await user.type(message, 'brb');

      expect(useSettingsStore.getState().autoAwayMessage).toBe('brb');
    });
  });
});
