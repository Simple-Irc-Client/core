import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ChannelCategory } from '@shared/types';

import E2eeBanner from '../components/E2eeBanner';
import { E2eeState, useE2eeStore, type E2eeSession } from '../store/e2ee';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => (opts ? `${key}:${Object.values(opts).join(',')}` : key),
  }),
}));

const acceptIncomingOffer = vi.fn();
const declineIncomingOffer = vi.fn();
const endSession = vi.fn();
const offerEncryption = vi.fn();

vi.mock('../session', () => ({
  acceptIncomingOffer: (nick: string) => acceptIncomingOffer(nick),
  declineIncomingOffer: (nick: string) => declineIncomingOffer(nick),
  endSession: (nick: string, notify?: boolean) => endSession(nick, notify),
  offerEncryption: (nick: string) => offerEncryption(nick),
}));

const settings = { currentChannelName: 'bob', currentChannelCategory: ChannelCategory.priv as ChannelCategory };

vi.mock('@features/settings/store/settings', () => ({
  useSettingsStore: (selector: (state: typeof settings) => unknown) => selector(settings),
  getCaseMapping: () => 'ascii',
}));

const setSessionState = (session: Partial<E2eeSession> & { state: E2eeState }): void => {
  useE2eeStore.setState({ sessions: { bob: { peer: 'bob', verified: false, ...session } } });
};

describe('E2eeBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useE2eeStore.setState({ sessions: {} });
    settings.currentChannelName = 'bob';
    settings.currentChannelCategory = ChannelCategory.priv;
  });

  it('shows nothing when there is no session', () => {
    render(<E2eeBanner />);

    expect(screen.queryByTestId('e2ee-banner')).not.toBeInTheDocument();
  });

  it('shows nothing on a channel window, where encryption does not apply', () => {
    settings.currentChannelName = '#chan';
    settings.currentChannelCategory = ChannelCategory.channel;
    useE2eeStore.setState({ sessions: { '#chan': { peer: '#chan', state: E2eeState.active, verified: false } } });

    render(<E2eeBanner />);

    expect(screen.queryByTestId('e2ee-banner')).not.toBeInTheDocument();
  });

  it('offers accept and decline for an incoming request', async () => {
    const user = userEvent.setup();
    setSessionState({ state: E2eeState.incoming });

    render(<E2eeBanner />);

    expect(screen.getByTestId('e2ee-banner')).toHaveTextContent('e2ee.banner.incoming:bob');

    await user.click(screen.getByRole('button', { name: 'e2ee.action.accept' }));
    expect(acceptIncomingOffer).toHaveBeenCalledWith('bob');

    await user.click(screen.getByRole('button', { name: 'e2ee.action.decline' }));
    expect(declineIncomingOffer).toHaveBeenCalledWith('bob');
  });

  it('lets the user cancel while waiting for a reply', async () => {
    const user = userEvent.setup();
    setSessionState({ state: E2eeState.offered });

    render(<E2eeBanner />);
    await user.click(screen.getByRole('button', { name: 'e2ee.action.cancel' }));

    expect(endSession).toHaveBeenCalledWith('bob', undefined);
  });

  it('nags while an active session is unverified', () => {
    setSessionState({ state: E2eeState.active, verified: false });

    render(<E2eeBanner />);

    expect(screen.getByTestId('e2ee-banner')).toHaveTextContent('e2ee.banner.unverified:bob');
  });

  it('goes quiet once the session is verified', () => {
    setSessionState({ state: E2eeState.active, verified: true });

    render(<E2eeBanner />);

    expect(screen.queryByTestId('e2ee-banner')).not.toBeInTheDocument();
  });

  it('warns loudly when the peer key changed', () => {
    setSessionState({ state: E2eeState.fingerprintChanged, expectedFingerprint: 'AAAA', theirFingerprint: 'BBBB' });

    render(<E2eeBanner />);

    const banner = screen.getByTestId('e2ee-banner');
    expect(banner).toHaveTextContent('e2ee.banner.fingerprintChanged:bob');
    expect(banner.className).toContain('red');
  });

  it('surfaces the session error message and offers a retry', async () => {
    const user = userEvent.setup();
    setSessionState({ state: E2eeState.error, errorMessage: 'bob did not respond' });

    render(<E2eeBanner />);

    expect(screen.getByTestId('e2ee-banner')).toHaveTextContent('bob did not respond');

    await user.click(screen.getByRole('button', { name: 'e2ee.action.retry' }));
    expect(offerEncryption).toHaveBeenCalledWith('bob');
  });

  it('does not nag after the peer declined', () => {
    setSessionState({ state: E2eeState.declined });

    render(<E2eeBanner />);

    expect(screen.queryByTestId('e2ee-banner')).not.toBeInTheDocument();
  });

  it('matches the window name case-insensitively', () => {
    settings.currentChannelName = 'BOB';
    setSessionState({ state: E2eeState.incoming });

    render(<E2eeBanner />);

    expect(screen.getByTestId('e2ee-banner')).toBeInTheDocument();
  });
});
