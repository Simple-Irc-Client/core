import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import NickRegainBanner from '../NickRegainBanner';
import * as nickRegain from '../../nickRegain';
import { useSettingsStore } from '@features/settings/store/settings';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key) }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

describe('NickRegainBanner', () => {
  beforeEach(() => {
    useSettingsStore.setState({ nick: 'piotr_', wantedNick: 'piotr', isConnected: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should say which nick is taken and which one the user has meanwhile', () => {
    render(<NickRegainBanner />);

    expect(screen.getByTestId('nick-regain-banner')).toHaveTextContent('nickRegain.banner {"nick":"piotr","current":"piotr_"}');
  });

  it('should take the nick back, or settle for the current one, when asked', () => {
    const reclaim = vi.spyOn(nickRegain, 'reclaimWantedNick').mockImplementation(() => {});
    const forget = vi.spyOn(nickRegain, 'forgetWantedNick').mockImplementation(() => {});
    render(<NickRegainBanner />);

    fireEvent.click(screen.getByRole('button', { name: 'nickRegain.reclaim' }));
    fireEvent.click(screen.getByRole('button', { name: 'nickRegain.keep {"nick":"piotr_"}' }));

    expect(reclaim).toHaveBeenCalledOnce();
    expect(forget).toHaveBeenCalledOnce();
  });

  it('should go away once the nick is back', () => {
    render(<NickRegainBanner />);

    act(() => {
      useSettingsStore.setState({ nick: 'Piotr' });
    });

    expect(screen.queryByTestId('nick-regain-banner')).not.toBeInTheDocument();
  });

  it.each([
    ['nothing is wanted', { wantedNick: undefined }],
    ['disconnected', { isConnected: false }],
  ])('should not show when %s', (_case, fields) => {
    useSettingsStore.setState(fields);

    render(<NickRegainBanner />);

    expect(screen.queryByTestId('nick-regain-banner')).not.toBeInTheDocument();
  });
});
