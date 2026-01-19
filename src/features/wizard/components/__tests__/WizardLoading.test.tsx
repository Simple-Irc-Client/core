import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import WizardLoading from '../WizardLoading';
import * as settingsStore from '@features/settings/store/settings';

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

describe('WizardLoading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const setupMocks = (overrides: {
    isConnecting?: boolean;
    isConnected?: boolean;
    wizardProgress?: { value: number; label: string };
  } = {}) => {
    const {
      isConnecting = false,
      isConnected = false,
      wizardProgress = { value: 0, label: '' },
    } = overrides;

    vi.mocked(settingsStore.useSettingsStore).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (selector: any) => selector({ isConnecting, isConnected, wizardProgress })
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
      setupMocks({
        isConnecting: false,
        isConnected: false,
        wizardProgress: { value: 2, label: 'Some label' },
      });

      render(<WizardLoading />);

      expect(settingsStore.setWizardProgress).toHaveBeenCalledWith(0, 'wizard.loading.disconnected');
    });

    it('should not call setWizardProgress when disconnected but progress is already 0', () => {
      setupMocks({
        isConnecting: false,
        isConnected: false,
        wizardProgress: { value: 0, label: '' },
      });

      render(<WizardLoading />);

      expect(settingsStore.setWizardProgress).not.toHaveBeenCalled();
    });
  });

  describe('State transitions', () => {
    it('should handle transition from connecting to connected', () => {
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
});
