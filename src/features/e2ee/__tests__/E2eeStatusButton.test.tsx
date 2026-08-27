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

const endSessionAndAnnounce = vi.fn();
const markVerified = vi.fn();
const offerEncryption = vi.fn();
const acknowledgePlaintext = vi.fn();

/** Whether this peer has ever been pinned on this network. */
const peerIsPinned = { value: false };

vi.mock('../session', () => ({
  markVerified: (nick: string, verified: boolean) => markVerified(nick, verified),
  offerEncryption: (nick: string) => offerEncryption(nick),
  acknowledgePlaintext: (nick: string) => acknowledgePlaintext(nick),
  hasPinnedPeer: () => peerIsPinned.value,
}));

vi.mock('../incoming', () => ({
  endSessionAndAnnounce: (nick: string, notify?: boolean) => endSessionAndAnnounce(nick, notify),
}));

const settings = { e2eeEnabled: true, isConnected: true };

vi.mock('@features/settings/store/settings', () => ({
  getCaseMapping: () => 'ascii',
  useSettingsStore: (selector: (state: typeof settings) => unknown) => selector(settings),
}));

const setSessionState = (session: Partial<E2eeSession> & { state: E2eeState }): void => {
  useE2eeStore.setState({ sessions: { bob: { peer: 'bob', verified: false, ...session } } });
};

describe('E2eeStatusButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useE2eeStore.setState({ sessions: {}, plaintextAcknowledged: {} });
    peerIsPinned.value = false;
    settings.e2eeEnabled = true;
    settings.isConnected = true;
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

  it('offers no way to start encryption while disconnected', async () => {
    const user = userEvent.setup();
    settings.isConnected = false;

    render(<E2eeStatusButton channelName="bob" />);
    await user.click(screen.getByTestId('e2ee-status-button'));

    expect(screen.queryByTestId('e2ee-start-button')).not.toBeInTheDocument();
    expect(screen.getByText('main.chat.notConnected')).toBeInTheDocument();
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

  it('closes the popover once marked verified', async () => {
    const user = userEvent.setup();
    setSessionState({ state: E2eeState.active, verified: false });

    render(<E2eeStatusButton channelName="bob" />);
    await user.click(screen.getByTestId('e2ee-status-button'));
    await user.click(screen.getByTestId('e2ee-verify-button'));

    expect(screen.queryByTestId('e2ee-verify-button')).not.toBeInTheDocument();
  });

  it('keeps the popover open when unverifying', async () => {
    const user = userEvent.setup();
    setSessionState({ state: E2eeState.active, verified: true });

    render(<E2eeStatusButton channelName="bob" />);
    await user.click(screen.getByTestId('e2ee-status-button'));
    await user.click(screen.getByTestId('e2ee-verify-button'));

    expect(markVerified).toHaveBeenCalledWith('bob', false);
    expect(screen.getByTestId('e2ee-verify-button')).toBeInTheDocument();
  });

  it('ends the session from the panel', async () => {
    const user = userEvent.setup();
    setSessionState({ state: E2eeState.active });

    render(<E2eeStatusButton channelName="bob" />);
    await user.click(screen.getByTestId('e2ee-status-button'));
    await user.click(screen.getByTestId('e2ee-end-button'));

    expect(endSessionAndAnnounce).toHaveBeenCalledWith('bob', undefined);
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

  describe('plaintext downgrade', () => {
    it('marks an unencrypted conversation with a known peer differently from a stranger', () => {
      const { rerender } = render(<E2eeStatusButton channelName="bob" />);
      expect(screen.getByTestId('e2ee-status-button')).toHaveAttribute('aria-label', 'e2ee.status.off');

      peerIsPinned.value = true;
      rerender(<E2eeStatusButton channelName="bob" />);

      expect(screen.getByTestId('e2ee-status-button')).toHaveAttribute('aria-label', 'e2ee.status.plaintextAgain');
    });

    it('explains the situation in the panel', async () => {
      const user = userEvent.setup();
      peerIsPinned.value = true;

      render(<E2eeStatusButton channelName="bob" />);
      await user.click(screen.getByTestId('e2ee-status-button'));

      expect(screen.getByText('e2ee.panel.plaintextAgainHint:bob')).toBeInTheDocument();
    });

    it('treats turning encryption off as accepting plaintext', async () => {
      const user = userEvent.setup();
      setSessionState({ state: E2eeState.active });

      render(<E2eeStatusButton channelName="bob" />);
      await user.click(screen.getByTestId('e2ee-status-button'));
      await user.click(screen.getByTestId('e2ee-end-button'));

      // Otherwise the downgrade warning would appear the instant the user
      // turned it off themselves.
      expect(endSessionAndAnnounce).toHaveBeenCalledWith('bob', undefined);
      expect(acknowledgePlaintext).toHaveBeenCalledWith('bob');
    });

    it('keeps the changed-key state louder than the downgrade state', () => {
      peerIsPinned.value = true;
      setSessionState({ state: E2eeState.fingerprintChanged, expectedFingerprint: 'AAAA', theirFingerprint: 'BBBB' });

      render(<E2eeStatusButton channelName="bob" />);

      expect(screen.getByTestId('e2ee-status-button')).toHaveAttribute('aria-label', 'e2ee.status.fingerprintChanged');
    });
  });
});
