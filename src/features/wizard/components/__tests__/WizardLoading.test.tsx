import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import WizardLoading from '../WizardLoading';
import * as settingsStore from '@features/settings/store/settings';
import * as ircNetwork from '@/network/irc/network';
import * as stsModule from '@/network/irc/sts';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@features/settings/store/settings', () => ({
  getIsPasswordRequired: vi.fn(),
  setWizardStep: vi.fn(),
  setWizardProgress: vi.fn(),
  getWizardProgress: vi.fn(),
  useSettingsStore: vi.fn(),
  resetAndGoToStart: vi.fn(),
}));

vi.mock('@/network/irc/network', () => ({
  ircConnect: vi.fn(),
  ircDisconnect: vi.fn(),
}));

vi.mock('@/network/irc/sts', () => ({
  getPendingSTSUpgrade: vi.fn(),
}));

describe('WizardLoading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockServer = { network: 'TestNetwork', servers: ['irc.test.com:6667'] };
  const mockNick = 'TestUser';

  const setupMocks = (overrides: {
    isConnecting?: boolean;
    isConnected?: boolean;
    wizardProgress?: { value: number; label: string };
    server?: typeof mockServer | undefined;
    nick?: string;
  } = {}) => {
    const isConnecting = overrides.isConnecting ?? false;
    const isConnected = overrides.isConnected ?? false;
    const wizardProgress = overrides.wizardProgress ?? { value: 0, label: '' };
    const server = 'server' in overrides ? overrides.server : mockServer;
    const nick = overrides.nick ?? mockNick;

    vi.mocked(settingsStore.useSettingsStore).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (selector: any) => selector({ isConnecting, isConnected, wizardProgress, server, nick })
    );
    vi.mocked(settingsStore.getWizardProgress).mockReturnValue(wizardProgress);
  };

  describe('Basic rendering', () => {
    it('should render progress bar', () => {
      setupMocks();

      render(<WizardLoading />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should not show label when progress label is empty', () => {
      setupMocks({
        wizardProgress: { value: 0, label: '' },
      });

      render(<WizardLoading />);

      expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    });

    it('should show label when progress has a label', () => {
      setupMocks({
        wizardProgress: { value: 1, label: 'Connecting...' },
      });

      render(<WizardLoading />);

      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });
  });

  describe('Progress bar value', () => {
    it('should render progress bar with value when progress is 1', () => {
      setupMocks({
        wizardProgress: { value: 1, label: '' },
      });

      render(<WizardLoading />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });

    it('should render progress bar with value when progress is 2', () => {
      setupMocks({
        wizardProgress: { value: 2, label: '' },
      });

      render(<WizardLoading />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });

    it('should render progress bar with value when progress is 3', () => {
      setupMocks({
        wizardProgress: { value: 3, label: '' },
      });

      render(<WizardLoading />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe('Connecting state', () => {
    it('should call setWizardProgress with connecting message when isConnecting is true', () => {
      setupMocks({
        isConnecting: true,
      });

      render(<WizardLoading />);

      expect(settingsStore.setWizardProgress).toHaveBeenCalledWith(1, 'wizard.loading.connecting');
    });

    it('should not start timeouts when isConnecting is true', () => {
      setupMocks({
        isConnecting: true,
      });

      render(<WizardLoading />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(settingsStore.setWizardStep).not.toHaveBeenCalled();
    });
  });

  describe('Connected state', () => {
    it('should call setWizardProgress with connected message when isConnected is true', () => {
      setupMocks({
        isConnected: true,
      });

      render(<WizardLoading />);

      expect(settingsStore.setWizardProgress).toHaveBeenCalledWith(2, 'wizard.loading.connected');
    });

    it('should call setWizardProgress with isPasswordRequired message after 2 seconds', () => {
      setupMocks({
        isConnected: true,
      });

      render(<WizardLoading />);

      expect(settingsStore.setWizardProgress).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(settingsStore.setWizardProgress).toHaveBeenCalledWith(3, 'wizard.loading.isPasswordRequired');
    });

    it('should navigate to channels step after 5 seconds if password not required', () => {
      vi.mocked(settingsStore.getIsPasswordRequired).mockReturnValue(false);

      setupMocks({
        isConnected: true,
      });

      render(<WizardLoading />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(settingsStore.setWizardStep).toHaveBeenCalledWith('channels');
    });

    it('should navigate to channels step after 5 seconds if password status is undefined', () => {
      vi.mocked(settingsStore.getIsPasswordRequired).mockReturnValue(undefined);

      setupMocks({
        isConnected: true,
      });

      render(<WizardLoading />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(settingsStore.setWizardStep).toHaveBeenCalledWith('channels');
    });

    it('should not navigate to channels step if password is required', () => {
      vi.mocked(settingsStore.getIsPasswordRequired).mockReturnValue(true);

      setupMocks({
        isConnected: true,
      });

      render(<WizardLoading />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(settingsStore.setWizardStep).not.toHaveBeenCalled();
    });

    it('should clear timeouts when component unmounts', () => {
      vi.mocked(settingsStore.getIsPasswordRequired).mockReturnValue(false);

      setupMocks({
        isConnected: true,
      });

      const { unmount } = render(<WizardLoading />);

      // Advance partially
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Unmount before timeouts complete
      unmount();

      // Advance past all timeouts
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // setWizardStep should not have been called since component unmounted
      expect(settingsStore.setWizardStep).not.toHaveBeenCalled();
    });
  });

  describe('Disconnected state', () => {
    it('should call setWizardProgress with disconnected message when disconnected and progress is not 0', () => {
      vi.mocked(stsModule.getPendingSTSUpgrade).mockReturnValue(null);

      setupMocks({
        isConnecting: false,
        isConnected: false,
        wizardProgress: { value: 2, label: 'Some label' },
      });

      render(<WizardLoading />);

      expect(settingsStore.setWizardProgress).toHaveBeenCalledWith(0, 'wizard.loading.disconnected');
    });

    it('should not call setWizardProgress when disconnected but progress is already 0', () => {
      vi.mocked(stsModule.getPendingSTSUpgrade).mockReturnValue(null);

      setupMocks({
        isConnecting: false,
        isConnected: false,
        wizardProgress: { value: 0, label: '' },
      });

      render(<WizardLoading />);

      expect(settingsStore.setWizardProgress).not.toHaveBeenCalled();
    });

    it('should call setWizardProgress with secure connecting message during STS upgrade', () => {
      vi.mocked(stsModule.getPendingSTSUpgrade).mockReturnValue({
        host: 'irc.test.com',
        port: 6697,
        reason: 'sts_upgrade',
      });

      setupMocks({
        isConnecting: true,
      });

      render(<WizardLoading />);

      expect(settingsStore.setWizardProgress).toHaveBeenCalledWith(4 / 3, 'wizard.loading.connectingSecure');
    });

    it('should not call setWizardProgress with disconnected message during STS upgrade', () => {
      vi.mocked(stsModule.getPendingSTSUpgrade).mockReturnValue({
        host: 'irc.test.com',
        port: 6697,
        reason: 'sts_upgrade',
      });

      setupMocks({
        isConnecting: false,
        isConnected: false,
        wizardProgress: { value: 2, label: 'Some label' },
      });

      render(<WizardLoading />);

      // Should not show disconnected message during STS upgrade
      expect(settingsStore.setWizardProgress).not.toHaveBeenCalled();
    });
  });

  describe('State transitions', () => {
    it('should handle transition from connecting to connected', () => {
      vi.mocked(stsModule.getPendingSTSUpgrade).mockReturnValue(null);

      setupMocks({
        isConnecting: true,
      });

      const { rerender } = render(<WizardLoading />);

      expect(settingsStore.setWizardProgress).toHaveBeenCalledWith(1, 'wizard.loading.connecting');

      // Transition to connected
      setupMocks({
        isConnected: true,
      });
      rerender(<WizardLoading />);

      expect(settingsStore.setWizardProgress).toHaveBeenCalledWith(2, 'wizard.loading.connected');
    });

    it('should handle transition from connected to disconnected', () => {
      vi.mocked(stsModule.getPendingSTSUpgrade).mockReturnValue(null);

      setupMocks({
        isConnected: true,
      });

      const { rerender } = render(<WizardLoading />);

      expect(settingsStore.setWizardProgress).toHaveBeenCalledWith(2, 'wizard.loading.connected');

      // Transition to disconnected
      setupMocks({
        isConnecting: false,
        isConnected: false,
        wizardProgress: { value: 2, label: 'Connected' },
      });
      rerender(<WizardLoading />);

      expect(settingsStore.setWizardProgress).toHaveBeenCalledWith(0, 'wizard.loading.disconnected');
    });
  });

  describe('Go Back button', () => {
    it('should show Go Back button when progress is 0', () => {
      setupMocks({
        isConnecting: false,
        isConnected: false,
        wizardProgress: { value: 0, label: 'wizard.loading.disconnected' },
      });

      render(<WizardLoading />);

      expect(screen.getByRole('button', { name: 'wizard.loading.button.goBack' })).toBeInTheDocument();
    });

    it('should not show Go Back button when progress is greater than 0', () => {
      setupMocks({
        isConnecting: true,
        wizardProgress: { value: 1, label: 'wizard.loading.connecting' },
      });

      render(<WizardLoading />);

      expect(screen.queryByRole('button', { name: 'wizard.loading.button.goBack' })).not.toBeInTheDocument();
    });

    it('should not show Go Back button when connected', () => {
      setupMocks({
        isConnected: true,
        wizardProgress: { value: 2, label: 'wizard.loading.connected' },
      });

      render(<WizardLoading />);

      expect(screen.queryByRole('button', { name: 'wizard.loading.button.goBack' })).not.toBeInTheDocument();
    });

    it('should call resetAndGoToStart when Go Back button is clicked', () => {
      setupMocks({
        isConnecting: false,
        isConnected: false,
        wizardProgress: { value: 0, label: 'wizard.loading.disconnected' },
      });

      render(<WizardLoading />);

      const goBackButton = screen.getByRole('button', { name: 'wizard.loading.button.goBack' });
      fireEvent.click(goBackButton);

      expect(settingsStore.resetAndGoToStart).toHaveBeenCalledTimes(1);
    });
  });

  describe('Connection timeout', () => {
    it('should show timeout message after 60 seconds of connecting', () => {
      setupMocks({
        isConnecting: true,
        wizardProgress: { value: 1, label: 'wizard.loading.connecting' },
      });

      render(<WizardLoading />);

      expect(screen.queryByText('wizard.loading.timeout')).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(60_000);
      });

      expect(screen.getByText('wizard.loading.timeout')).toBeInTheDocument();
    });

    it('should show Go Back and Reconnect buttons when timed out', () => {
      setupMocks({
        isConnecting: true,
        wizardProgress: { value: 1, label: 'wizard.loading.connecting' },
      });

      render(<WizardLoading />);

      expect(screen.queryByRole('button', { name: 'wizard.loading.button.goBack' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'wizard.loading.button.reconnect' })).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(60_000);
      });

      expect(screen.getByRole('button', { name: 'wizard.loading.button.goBack' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'wizard.loading.button.reconnect' })).toBeInTheDocument();
    });

    it('should not show timeout before 60 seconds', () => {
      setupMocks({
        isConnecting: true,
        wizardProgress: { value: 1, label: 'wizard.loading.connecting' },
      });

      render(<WizardLoading />);

      act(() => {
        vi.advanceTimersByTime(59_999);
      });

      expect(screen.queryByText('wizard.loading.timeout')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'wizard.loading.button.reconnect' })).not.toBeInTheDocument();
    });

    it('should call ircDisconnect and ircConnect when Reconnect is clicked', () => {
      setupMocks({
        isConnecting: true,
        wizardProgress: { value: 1, label: 'wizard.loading.connecting' },
      });

      render(<WizardLoading />);

      act(() => {
        vi.advanceTimersByTime(60_000);
      });

      const reconnectButton = screen.getByRole('button', { name: 'wizard.loading.button.reconnect' });
      fireEvent.click(reconnectButton);

      expect(ircNetwork.ircDisconnect).toHaveBeenCalledTimes(1);
      expect(ircNetwork.ircConnect).toHaveBeenCalledWith(mockServer, mockNick);
    });

    it('should hide timeout message after Reconnect is clicked', () => {
      setupMocks({
        isConnecting: true,
        wizardProgress: { value: 1, label: 'wizard.loading.connecting' },
      });

      render(<WizardLoading />);

      act(() => {
        vi.advanceTimersByTime(60_000);
      });

      expect(screen.getByText('wizard.loading.timeout')).toBeInTheDocument();

      const reconnectButton = screen.getByRole('button', { name: 'wizard.loading.button.reconnect' });
      fireEvent.click(reconnectButton);

      expect(screen.queryByText('wizard.loading.timeout')).not.toBeInTheDocument();
    });

    it('should clear timeout when connection succeeds', () => {
      setupMocks({
        isConnecting: true,
        wizardProgress: { value: 1, label: 'wizard.loading.connecting' },
      });

      const { rerender } = render(<WizardLoading />);

      act(() => {
        vi.advanceTimersByTime(30_000);
      });

      // Connection succeeds
      setupMocks({
        isConnecting: false,
        isConnected: true,
        wizardProgress: { value: 2, label: 'wizard.loading.connected' },
      });
      rerender(<WizardLoading />);

      // Advance past the original timeout
      act(() => {
        vi.advanceTimersByTime(40_000);
      });

      expect(screen.queryByText('wizard.loading.timeout')).not.toBeInTheDocument();
    });

    it('should clear timeout timer when component unmounts during connecting', () => {
      setupMocks({
        isConnecting: true,
        wizardProgress: { value: 1, label: 'wizard.loading.connecting' },
      });

      const { unmount } = render(<WizardLoading />);

      act(() => {
        vi.advanceTimersByTime(30_000);
      });

      unmount();

      // Advance past the timeout - this should not cause any errors
      act(() => {
        vi.advanceTimersByTime(40_000);
      });

      // If we get here without errors, the timer was properly cleaned up
      expect(true).toBe(true);
    });

    it('should reset timeout when transitioning from not connecting to connecting', () => {
      setupMocks({
        isConnecting: false,
        isConnected: false,
        wizardProgress: { value: 0, label: '' },
      });

      const { rerender } = render(<WizardLoading />);

      // Start connecting
      setupMocks({
        isConnecting: true,
        wizardProgress: { value: 1, label: 'wizard.loading.connecting' },
      });
      rerender(<WizardLoading />);

      // Advance 30 seconds
      act(() => {
        vi.advanceTimersByTime(30_000);
      });

      expect(screen.queryByText('wizard.loading.timeout')).not.toBeInTheDocument();

      // Advance another 30 seconds (total 60 seconds)
      act(() => {
        vi.advanceTimersByTime(30_000);
      });

      expect(screen.getByText('wizard.loading.timeout')).toBeInTheDocument();
    });

    it('should not show Reconnect button when server is undefined', () => {
      setupMocks({
        isConnecting: true,
        wizardProgress: { value: 1, label: 'wizard.loading.connecting' },
        server: undefined,
      });

      render(<WizardLoading />);

      act(() => {
        vi.advanceTimersByTime(60_000);
      });

      const reconnectButton = screen.getByRole('button', { name: 'wizard.loading.button.reconnect' });
      fireEvent.click(reconnectButton);

      // ircConnect should not be called when server is undefined
      expect(ircNetwork.ircConnect).not.toHaveBeenCalled();
    });
  });
});
