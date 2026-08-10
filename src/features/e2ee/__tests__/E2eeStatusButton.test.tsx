import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import E2eeStatusButton from '../components/E2eeStatusButton';
import { E2eeState, useE2eeStore, type E2eeSession } from '../store/e2ee';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) => (opts ? `${key}:${Object.values(opts).join(',')}` : key),
  }),
}));

const endSession = vi.fn();
const markVerified = vi.fn();
const offerEncryption = vi.fn();

vi.mock('../session', () => ({
  endSession: (nick: string, notify?: boolean) => endSession(nick, notify),
  markVerified: (nick: string, verified: boolean) => markVerified(nick, verified),
  offerEncryption: (nick: string) => offerEncryption(nick),
}));

vi.mock('@features/settings/store/settings', () => ({ getCaseMapping: () => 'ascii' }));

const setSessionState = (session: Partial<E2eeSession> & { state: E2eeState }): void => {
  useE2eeStore.setState({ sessions: { bob: { peer: 'bob', verified: false, ...session } } });
};

describe('E2eeStatusButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useE2eeStore.setState({ sessions: {} });
  });

  it('labels the button as not encrypted when there is no session', () => {
    render(<E2eeStatusButton channelName="bob" />);

    expect(screen.getByTestId('e2ee-status-button')).toHaveAttribute('aria-label', 'e2ee.status.off');
  });

  it('offers to start encryption from the panel', async () => {
    const user = userEvent.setup();
    render(<E2eeStatusButton channelName="bob" />);

    await user.click(screen.getByTestId('e2ee-status-button'));
    await user.click(screen.getByTestId('e2ee-start-button'));

    expect(offerEncryption).toHaveBeenCalledWith('bob');
  });

  it('distinguishes a verified session from an unverified one in the label', () => {
    setSessionState({ state: E2eeState.active, verified: false });
    const { rerender } = render(<E2eeStatusButton channelName="bob" />);
    expect(screen.getByTestId('e2ee-status-button')).toHaveAttribute('aria-label', 'e2ee.status.unverified');

    setSessionState({ state: E2eeState.active, verified: true });
    rerender(<E2eeStatusButton channelName="bob" />);
    expect(screen.getByTestId('e2ee-status-button')).toHaveAttribute('aria-label', 'e2ee.status.verified');
  });

  it('shows both fingerprints so they can be compared out of band', async () => {
    const user = userEvent.setup();
    setSessionState({
      state: E2eeState.active,
      myFingerprint: '4F2A 91BC E07D 22A1',
      theirFingerprint: '8B03 71DE C4A9 F510',
    });

    render(<E2eeStatusButton channelName="bob" />);
    await user.click(screen.getByTestId('e2ee-status-button'));

    expect(screen.getByTestId('e2ee-my-fingerprint')).toHaveTextContent('4F2A 91BC E07D 22A1');
    expect(screen.getByTestId('e2ee-their-fingerprint')).toHaveTextContent('8B03 71DE C4A9 F510');
  });

  it('toggles verification', async () => {
    const user = userEvent.setup();
    setSessionState({ state: E2eeState.active, verified: false });

    render(<E2eeStatusButton channelName="bob" />);
    await user.click(screen.getByTestId('e2ee-status-button'));
    await user.click(screen.getByTestId('e2ee-verify-button'));

    expect(markVerified).toHaveBeenCalledWith('bob', true);
  });

  it('ends the session from the panel', async () => {
    const user = userEvent.setup();
    setSessionState({ state: E2eeState.active });

    render(<E2eeStatusButton channelName="bob" />);
    await user.click(screen.getByTestId('e2ee-status-button'));
    await user.click(screen.getByTestId('e2ee-end-button'));

    expect(endSession).toHaveBeenCalledWith('bob', undefined);
  });

  it('does not present a changed key as if it were an encrypted session', async () => {
    const user = userEvent.setup();
    setSessionState({
      state: E2eeState.fingerprintChanged,
      expectedFingerprint: 'AAAA BBBB CCCC DDDD',
      theirFingerprint: 'EEEE FFFF 0000 1111',
    });

    render(<E2eeStatusButton channelName="bob" />);
    expect(screen.getByTestId('e2ee-status-button')).toHaveAttribute('aria-label', 'e2ee.status.fingerprintChanged');

    await user.click(screen.getByTestId('e2ee-status-button'));

    // No verify button here — the user must not be able to bless a swapped key
    // from the same panel that reports the swap.
    expect(screen.queryByTestId('e2ee-verify-button')).not.toBeInTheDocument();
    expect(screen.getByText('AAAA BBBB CCCC DDDD')).toBeInTheDocument();
    expect(screen.getByText('EEEE FFFF 0000 1111')).toBeInTheDocument();
  });
});
