import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HighlightWordsSetting from '../HighlightWordsSetting';
import { useSettingsStore } from '@features/settings/store/settings';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { word?: string }) => (options?.word === undefined ? key : `${key}:${options.word}`),
  }),
}));

vi.mock('@/app/i18n', () => ({
  default: {},
}));

const words = (): string[] => useSettingsStore.getState().highlightWords;

describe('HighlightWordsSetting', () => {
  beforeEach(() => {
    useSettingsStore.setState({ highlightWords: [] });
  });

  it('should add a word with Enter, trimmed, and clear the field', async () => {
    const user = userEvent.setup();
    render(<HighlightWordsSetting />);

    await user.type(screen.getByLabelText('profileSettings.highlightWords'), '  deploy {Enter}');

    expect(words()).toEqual(['deploy']);
    expect(screen.getByLabelText('profileSettings.highlightWords')).toHaveValue('');
    expect(screen.getByTestId('highlight-words-list')).toHaveTextContent('deploy');
  });

  it('should add a phrase with the button', async () => {
    const user = userEvent.setup();
    render(<HighlightWordsSetting />);

    await user.type(screen.getByLabelText('profileSettings.highlightWords'), 'build failed');
    await user.click(screen.getByRole('button', { name: 'profileSettings.addHighlightWord' }));

    expect(words()).toEqual(['build failed']);
  });

  it('should not add a blank word', async () => {
    const user = userEvent.setup();
    render(<HighlightWordsSetting />);

    await user.type(screen.getByLabelText('profileSettings.highlightWords'), '   {Enter}');
    await user.click(screen.getByRole('button', { name: 'profileSettings.addHighlightWord' }));

    expect(words()).toEqual([]);
    expect(screen.queryByTestId('highlight-words-list')).not.toBeInTheDocument();
  });

  it('should not add a word already on the list, whatever its case', async () => {
    useSettingsStore.setState({ highlightWords: ['Deploy'] });
    const user = userEvent.setup();
    render(<HighlightWordsSetting />);

    await user.type(screen.getByLabelText('profileSettings.highlightWords'), 'deploy{Enter}');

    expect(words()).toEqual(['Deploy']);
    expect(screen.getByLabelText('profileSettings.highlightWords')).toHaveValue('');
  });

  it('should remove a word', async () => {
    useSettingsStore.setState({ highlightWords: ['deploy', 'release'] });
    const user = userEvent.setup();
    render(<HighlightWordsSetting />);

    await user.click(screen.getByRole('button', { name: 'profileSettings.removeHighlightWord:deploy' }));

    expect(words()).toEqual(['release']);
    expect(screen.getByTestId('highlight-words-list')).not.toHaveTextContent('deploy');
  });
});
