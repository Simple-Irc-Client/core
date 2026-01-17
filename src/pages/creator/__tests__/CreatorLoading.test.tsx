import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import CreatorLoading from '../CreatorLoading';
import * as settingsStore from '../../../store/settings';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../../store/settings', () => ({
  getIsPasswordRequired: vi.fn(),
  setCreatorStep: vi.fn(),
  setCreatorProgress: vi.fn(),
  getCreatorProgress: vi.fn(),
  useSettingsStore: vi.fn(),
  resetAndGoToStart: vi.fn(),
}));

describe('CreatorLoading', () => {
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
    creatorProgress?: { value: number; label: string };
  } = {}) => {
    const {
      isConnecting = false,
      isConnected = false,
      creatorProgress = { value: 0, label: '' },
    } = overrides;

    vi.mocked(settingsStore.useSettingsStore).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (selector: any) => selector({ isConnecting, isConnected, creatorProgress })
    );
    vi.mocked(settingsStore.getCreatorProgress).mockReturnValue(creatorProgress);
  };

  describe('Basic rendering', () => {
    it('should render progress bar', () => {
      setupMocks();

      render(<CreatorLoading />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should not show label when progress label is empty', () => {
      setupMocks({
        creatorProgress: { value: 0, label: '' },
      });

      render(<CreatorLoading />);

      expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    });

    it('should show label when progress has a label', () => {
      setupMocks({
        creatorProgress: { value: 1, label: 'Connecting...' },
      });

      render(<CreatorLoading />);

      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });
  });

  describe('Progress bar value', () => {
    it('should render progress bar with value when progress is 1', () => {
      setupMocks({
        creatorProgress: { value: 1, label: '' },
      });

      render(<CreatorLoading />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });

    it('should render progress bar with value when progress is 2', () => {
      setupMocks({
        creatorProgress: { value: 2, label: '' },
      });

      render(<CreatorLoading />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });

    it('should render progress bar with value when progress is 3', () => {
      setupMocks({
        creatorProgress: { value: 3, label: '' },
      });

      render(<CreatorLoading />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe('Connecting state', () => {
    it('should call setCreatorProgress with connecting message when isConnecting is true', () => {
      setupMocks({
        isConnecting: true,
      });

      render(<CreatorLoading />);

      expect(settingsStore.setCreatorProgress).toHaveBeenCalledWith(1, 'creator.loading.connecting');
    });

    it('should not start timeouts when isConnecting is true', () => {
      setupMocks({
        isConnecting: true,
      });

      render(<CreatorLoading />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(settingsStore.setCreatorStep).not.toHaveBeenCalled();
    });
  });

  describe('Connected state', () => {
    it('should call setCreatorProgress with connected message when isConnected is true', () => {
      setupMocks({
        isConnected: true,
      });

      render(<CreatorLoading />);

      expect(settingsStore.setCreatorProgress).toHaveBeenCalledWith(2, 'creator.loading.connected');
    });

    it('should call setCreatorProgress with isPasswordRequired message after 2 seconds', () => {
      setupMocks({
        isConnected: true,
      });

      render(<CreatorLoading />);

      expect(settingsStore.setCreatorProgress).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      expect(settingsStore.setCreatorProgress).toHaveBeenCalledWith(3, 'creator.loading.isPasswordRequired');
    });

    it('should navigate to channels step after 5 seconds if password not required', () => {
      vi.mocked(settingsStore.getIsPasswordRequired).mockReturnValue(false);

      setupMocks({
        isConnected: true,
      });

      render(<CreatorLoading />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(settingsStore.setCreatorStep).toHaveBeenCalledWith('channels');
    });

    it('should navigate to channels step after 5 seconds if password status is undefined', () => {
      vi.mocked(settingsStore.getIsPasswordRequired).mockReturnValue(undefined);

      setupMocks({
        isConnected: true,
      });

      render(<CreatorLoading />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(settingsStore.setCreatorStep).toHaveBeenCalledWith('channels');
    });

    it('should not navigate to channels step if password is required', () => {
      vi.mocked(settingsStore.getIsPasswordRequired).mockReturnValue(true);

      setupMocks({
        isConnected: true,
      });

      render(<CreatorLoading />);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(settingsStore.setCreatorStep).not.toHaveBeenCalled();
    });

    it('should clear timeouts when component unmounts', () => {
      vi.mocked(settingsStore.getIsPasswordRequired).mockReturnValue(false);

      setupMocks({
        isConnected: true,
      });

      const { unmount } = render(<CreatorLoading />);

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

      // setCreatorStep should not have been called since component unmounted
      expect(settingsStore.setCreatorStep).not.toHaveBeenCalled();
    });
  });

  describe('Disconnected state', () => {
    it('should call setCreatorProgress with disconnected message when disconnected and progress is not 0', () => {
      setupMocks({
        isConnecting: false,
        isConnected: false,
        creatorProgress: { value: 2, label: 'Some label' },
      });

      render(<CreatorLoading />);

      expect(settingsStore.setCreatorProgress).toHaveBeenCalledWith(0, 'creator.loading.disconnected');
    });

    it('should not call setCreatorProgress when disconnected but progress is already 0', () => {
      setupMocks({
        isConnecting: false,
        isConnected: false,
        creatorProgress: { value: 0, label: '' },
      });

      render(<CreatorLoading />);

      expect(settingsStore.setCreatorProgress).not.toHaveBeenCalled();
    });
  });

  describe('State transitions', () => {
    it('should handle transition from connecting to connected', () => {
      setupMocks({
        isConnecting: true,
      });

      const { rerender } = render(<CreatorLoading />);

      expect(settingsStore.setCreatorProgress).toHaveBeenCalledWith(1, 'creator.loading.connecting');

      // Transition to connected
      setupMocks({
        isConnected: true,
      });
      rerender(<CreatorLoading />);

      expect(settingsStore.setCreatorProgress).toHaveBeenCalledWith(2, 'creator.loading.connected');
    });

    it('should handle transition from connected to disconnected', () => {
      setupMocks({
        isConnected: true,
      });

      const { rerender } = render(<CreatorLoading />);

      expect(settingsStore.setCreatorProgress).toHaveBeenCalledWith(2, 'creator.loading.connected');

      // Transition to disconnected
      setupMocks({
        isConnecting: false,
        isConnected: false,
        creatorProgress: { value: 2, label: 'Connected' },
      });
      rerender(<CreatorLoading />);

      expect(settingsStore.setCreatorProgress).toHaveBeenCalledWith(0, 'creator.loading.disconnected');
    });
  });

  describe('Go Back button', () => {
    it('should show Go Back button when progress is 0', () => {
      setupMocks({
        isConnecting: false,
        isConnected: false,
        creatorProgress: { value: 0, label: 'creator.loading.disconnected' },
      });

      render(<CreatorLoading />);

      expect(screen.getByRole('button', { name: 'creator.loading.button.goBack' })).toBeInTheDocument();
    });

    it('should not show Go Back button when progress is greater than 0', () => {
      setupMocks({
        isConnecting: true,
        creatorProgress: { value: 1, label: 'creator.loading.connecting' },
      });

      render(<CreatorLoading />);

      expect(screen.queryByRole('button', { name: 'creator.loading.button.goBack' })).not.toBeInTheDocument();
    });

    it('should not show Go Back button when connected', () => {
      setupMocks({
        isConnected: true,
        creatorProgress: { value: 2, label: 'creator.loading.connected' },
      });

      render(<CreatorLoading />);

      expect(screen.queryByRole('button', { name: 'creator.loading.button.goBack' })).not.toBeInTheDocument();
    });

    it('should call resetAndGoToStart when Go Back button is clicked', () => {
      setupMocks({
        isConnecting: false,
        isConnected: false,
        creatorProgress: { value: 0, label: 'creator.loading.disconnected' },
      });

      render(<CreatorLoading />);

      const goBackButton = screen.getByRole('button', { name: 'creator.loading.button.goBack' });
      fireEvent.click(goBackButton);

      expect(settingsStore.resetAndGoToStart).toHaveBeenCalledTimes(1);
    });
  });
});
