import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationSoundsSetting from '../NotificationSoundsSetting';
import { useSettingsStore } from '@features/settings/store/settings';
import * as soundsFile from '@features/sounds/sounds';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { label?: string }) => (options?.label === undefined ? key : `${key}:${options.label}`),
  }),
}));

vi.mock('@/app/i18n', () => ({
  default: {},
}));

// Radix Select needs pointer-capture APIs and scrollIntoView, which jsdom lacks
beforeAll(() => {
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.setPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('NotificationSoundsSetting', () => {
  beforeEach(() => {
    useSettingsStore.setState({ directSound: 'chime', mentionSound: 'ping', soundVolume: 60 });
  });

  it('should choose the private message sound', async () => {
    const user = userEvent.setup();
    render(<NotificationSoundsSetting />);

    await user.click(screen.getByTestId('direct-sound-select'));
    await user.click(screen.getByRole('option', { name: 'profileSettings.sound.trill' }));

    expect(useSettingsStore.getState().directSound).toBe('trill');
    expect(useSettingsStore.getState().mentionSound).toBe('ping');
  });

  it('should turn the mention sound off, and disable its preview', async () => {
    const user = userEvent.setup();
    render(<NotificationSoundsSetting />);

    await user.click(screen.getByTestId('mention-sound-select'));
    await user.click(screen.getByRole('option', { name: 'profileSettings.sound.off' }));

    expect(useSettingsStore.getState().mentionSound).toBe('off');
    expect(screen.getByRole('button', { name: 'profileSettings.playSound:profileSettings.mentionSound' })).toBeDisabled();
  });

  it('should preview the chosen sound at the chosen volume', async () => {
    const playSound = vi.spyOn(soundsFile, 'playSound').mockResolvedValue();
    const user = userEvent.setup();
    render(<NotificationSoundsSetting />);

    await user.click(screen.getByRole('button', { name: 'profileSettings.playSound:profileSettings.directSound' }));

    expect(playSound).toHaveBeenCalledWith('chime', 60);
  });

  it('should change the volume', () => {
    render(<NotificationSoundsSetting />);

    fireEvent.change(screen.getByLabelText('profileSettings.soundVolume'), { target: { value: '25' } });

    expect(useSettingsStore.getState().soundVolume).toBe(25);
    expect(screen.getByText('25%')).toBeInTheDocument();
  });
});
