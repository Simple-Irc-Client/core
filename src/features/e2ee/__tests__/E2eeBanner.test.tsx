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

const acceptOfferAndAnnounce = vi.fn();
const endSessionAndAnnounce = vi.fn();
const declineIncomingOffer = vi.fn();
const offerEncryption = vi.fn();
const acknowledgePlaintext = vi.fn();

/** Whether the peer in the window has ever been pinned on this network. */
const peerIsPinned = { value: false };

vi.mock('../session', () => ({
  declineIncomingOffer: (nick: string) => declineIncomingOffer(nick),
  offerEncryption: (nick: string) => offerEncryption(nick),
  acknowledgePlaintext: (nick: string) => acknowledgePlaintext(nick),
  hasPinnedPeer: () => peerIsPinned.value,
}));

vi.mock('../incoming', () => ({
  acceptOfferAndAnnounce: (nick: string) => acceptOfferAndAnnounce(nick),
  endSessionAndAnnounce: (nick: string, notify?: boolean) => endSessionAndAnnounce(nick, notify),
}));

const settings = { currentChannelName: 'bob', currentChannelCategory: ChannelCategory.priv as ChannelCategory, e2eeEnabled: true, isConnected: true };

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
    useE2eeStore.setState({ sessions: {}, plaintextAcknowledged: {} });
    settings.currentChannelName = 'bob';
    settings.currentChannelCategory = ChannelCategory.priv;
    settings.isConnected = true;
    peerIsPinned.value = false;
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
    expect(acceptOfferAndAnnounce).toHaveBeenCalledWith('bob');

    await user.click(screen.getByRole('button', { name: 'e2ee.action.decline' }));
    expect(declineIncomingOffer).toHaveBeenCalledWith('bob');
  });

  it('lets the user cancel while waiting for a reply', async () => {
    const user = userEvent.setup();
    setSessionState({ state: E2eeState.offered });

    render(<E2eeBanner />);
    await user.click(screen.getByRole('button', { name: 'e2ee.action.cancel' }));

    expect(endSessionAndAnnounce).toHaveBeenCalledWith('bob', undefined);
  });

  it('shows nothing for an active session, verified or not', () => {
    setSessionState({ state: E2eeState.active, verified: false });
    const { rerender } = render(<E2eeBanner />);
    expect(screen.queryByTestId('e2ee-banner')).not.toBeInTheDocument();

    setSessionState({ state: E2eeState.active, verified: true });
    rerender(<E2eeBanner />);
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

  it('offers no retry while disconnected', () => {
    settings.isConnected = false;
    setSessionState({ state: E2eeState.error, errorMessage: 'bob did not respond' });

    render(<E2eeBanner />);

    expect(screen.queryByRole('button', { name: 'e2ee.action.retry' })).not.toBeInTheDocument();
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

  describe('plaintext downgrade warning', () => {
    it('stays quiet for a peer never encrypted with', () => {
      render(<E2eeBanner />);

      expect(screen.queryByTestId('e2ee-banner')).not.toBeInTheDocument();
    });

    it('warns when a previously encrypted conversation is in the clear', () => {
      peerIsPinned.value = true;

      render(<E2eeBanner />);

      const banner = screen.getByTestId('e2ee-banner');
      expect(banner).toHaveTextContent('e2ee.banner.plaintextAgain:bob');
      // Messages are actually going out in the clear here, unlike the merely
      // unverified-but-still-encrypted state, so it must not share that color.
      expect(banner.className).toContain('red');
    });

    it('offers to encrypt again', async () => {
      const user = userEvent.setup();
      peerIsPinned.value = true;

      render(<E2eeBanner />);
      await user.click(screen.getByRole('button', { name: 'e2ee.action.encrypt' }));

      expect(offerEncryption).toHaveBeenCalledWith('bob');
    });

    it('offers no way to re-encrypt while disconnected', () => {
      peerIsPinned.value = true;
      settings.isConnected = false;

      render(<E2eeBanner />);

      expect(screen.queryByRole('button', { name: 'e2ee.action.encrypt' })).not.toBeInTheDocument();
      // The rest of the banner still makes sense while disconnected.
      expect(screen.getByRole('button', { name: 'e2ee.action.dismiss' })).toBeInTheDocument();
    });

    it('records the acknowledgement when dismissed', async () => {
      const user = userEvent.setup();
      peerIsPinned.value = true;

      render(<E2eeBanner />);
      await user.click(screen.getByRole('button', { name: 'e2ee.action.dismiss' }));

      expect(acknowledgePlaintext).toHaveBeenCalledWith('bob');
    });

    it('goes quiet once the acknowledgement is recorded', () => {
      peerIsPinned.value = true;
      useE2eeStore.setState({ sessions: {}, plaintextAcknowledged: { bob: true } });

      render(<E2eeBanner />);

      expect(screen.queryByTestId('e2ee-banner')).not.toBeInTheDocument();
    });

    it('defers to the more specific banner while a handshake is in progress', () => {
      peerIsPinned.value = true;
      setSessionState({ state: E2eeState.offered });

      render(<E2eeBanner />);

      expect(screen.getByTestId('e2ee-banner')).toHaveTextContent('e2ee.banner.offered:bob');
    });

    it('shows nothing while the session is active', () => {
      peerIsPinned.value = true;
      setSessionState({ state: E2eeState.active, verified: true });

      render(<E2eeBanner />);

      expect(screen.queryByTestId('e2ee-banner')).not.toBeInTheDocument();
    });

    it('does not raise a second banner when the user dismisses an error', async () => {
      const user = userEvent.setup();
      peerIsPinned.value = true;
      setSessionState({ state: E2eeState.error, errorMessage: 'bob did not respond' });

      render(<E2eeBanner />);
      await user.click(screen.getByRole('button', { name: 'e2ee.action.dismiss' }));

      // Without this the dismissed error would be replaced instantly by the
      // downgrade warning, and the user would be closing banners in a loop.
      expect(acknowledgePlaintext).toHaveBeenCalledWith('bob');
    });

    it('does not warn on a channel window', () => {
      peerIsPinned.value = true;
      settings.currentChannelName = '#chan';
      settings.currentChannelCategory = ChannelCategory.channel;

      render(<E2eeBanner />);

      expect(screen.queryByTestId('e2ee-banner')).not.toBeInTheDocument();
    });
  });
});
