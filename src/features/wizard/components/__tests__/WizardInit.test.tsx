import { describe, expect, it, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import WizardInit from '../WizardInit';
import * as settingsStore from '@features/settings/store/settings';
import * as network from '@/network/irc/network';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@features/settings/store/settings', () => ({
  setWizardStep: vi.fn(),
}));

vi.mock('@/network/irc/network', () => ({
  isConnected: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}));

// Mock window.location.reload
const mockReload = vi.fn();
Object.defineProperty(window, 'location', {
  value: { reload: mockReload },
  writable: true,
});

describe('WizardInit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('When waiting for connection (default state)', () => {
    beforeEach(() => {
      (network.isConnected as Mock).mockReturnValue(false);
    });

    it('should render nothing while waiting', () => {
      const { container } = render(<WizardInit />);

      expect(container).toBeEmptyDOMElement();
    });

    it('should not render the error title', () => {
      render(<WizardInit />);

      expect(screen.queryByText('wizard.init.title')).not.toBeInTheDocument();
    });

    it('should not render the retry button', () => {
      render(<WizardInit />);

      expect(screen.queryByText('wizard.init.button.retry')).not.toBeInTheDocument();
    });

    it('should register connect event listener', () => {
      render(<WizardInit />);

      expect(network.on).toHaveBeenCalledWith('connect', expect.any(Function));
    });

    it('should register error event listener', () => {
      render(<WizardInit />);

      expect(network.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should not call setWizardStep on mount', () => {
      render(<WizardInit />);

      expect(settingsStore.setWizardStep).not.toHaveBeenCalled();
    });

    it('should show error when error event fires', () => {
      render(<WizardInit />);

      // Get the callback that was registered with on('error', ...)
      const onCall = (network.on as Mock).mock.calls.find(
        (call) => call[0] === 'error'
      );
      const errorCallback = onCall?.[1];

      // Simulate the error event
      act(() => {
        errorCallback?.();
      });

      // Now should show error UI
      expect(screen.getByText('wizard.init.title')).toBeInTheDocument();
      expect(screen.getByText('wizard.init.button.retry')).toBeInTheDocument();
    });

    it('should navigate to nick step when connect event fires', () => {
      render(<WizardInit />);

      // Get the callback that was registered with on('connect', ...)
      const onCall = (network.on as Mock).mock.calls.find(
        (call) => call[0] === 'connect'
      );
      const connectCallback = onCall?.[1];

      // Simulate the connect event
      connectCallback?.();

      expect(settingsStore.setWizardStep).toHaveBeenCalledWith('nick');
    });

    it('should unregister event listeners on unmount', () => {
      const { unmount } = render(<WizardInit />);

      unmount();

      expect(network.off).toHaveBeenCalledWith('connect', expect.any(Function));
      expect(network.off).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('When error event fires (connection failed)', () => {
    beforeEach(() => {
      (network.isConnected as Mock).mockReturnValue(false);
    });

    const renderAndTriggerError = () => {
      render(<WizardInit />);

      // Get the callback that was registered with on('error', ...)
      const onCall = (network.on as Mock).mock.calls.find(
        (call) => call[0] === 'error'
      );
      const errorCallback = onCall?.[1];

      // Simulate the error event
      act(() => {
        errorCallback?.();
      });
    };

    it('should render the error title after error', () => {
      renderAndTriggerError();

      expect(screen.getByText('wizard.init.title')).toBeInTheDocument();
    });

    it('should render the error message after error', () => {
      renderAndTriggerError();

      expect(screen.getByText('wizard.init.message')).toBeInTheDocument();
    });

    it('should render the retry button after error', () => {
      renderAndTriggerError();

      expect(screen.getByText('wizard.init.button.retry')).toBeInTheDocument();
    });

    it('should reload the page when retry button is clicked', () => {
      renderAndTriggerError();

      const retryButton = screen.getByText('wizard.init.button.retry');
      fireEvent.click(retryButton);

      expect(mockReload).toHaveBeenCalled();
    });

    it('should have centered content', () => {
      renderAndTriggerError();

      const container = screen.getByText('wizard.init.title').parentElement;
      expect(container).toHaveClass('flex', 'flex-col', 'items-center');
    });

    it('should have proper heading level', () => {
      renderAndTriggerError();

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('wizard.init.title');
    });
  });

  describe('Delayed loading message', () => {
    beforeEach(() => {
      (network.isConnected as Mock).mockReturnValue(false);
    });

    it('should not show loading message before 3 seconds', () => {
      render(<WizardInit />);

      // Advance time by 2.9 seconds
      act(() => {
        vi.advanceTimersByTime(2900);
      });

      expect(screen.queryByText('wizard.init.loading')).not.toBeInTheDocument();
    });

    it('should show loading message after 3 seconds', () => {
      render(<WizardInit />);

      // Advance time by 3 seconds
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByText('wizard.init.loading')).toBeInTheDocument();
    });

    it('should not show loading message if connect event fires before 3 seconds', () => {
      render(<WizardInit />);

      // Advance time by 1 second
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Simulate connect event
      const onCall = (network.on as Mock).mock.calls.find(
        (call) => call[0] === 'connect'
      );
      const connectCallback = onCall?.[1];
      act(() => {
        connectCallback?.();
      });

      // Advance past 3 seconds
      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.queryByText('wizard.init.loading')).not.toBeInTheDocument();
    });

    it('should not show loading message if error event fires before 3 seconds', () => {
      render(<WizardInit />);

      // Advance time by 1 second
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Simulate error event
      const onCall = (network.on as Mock).mock.calls.find(
        (call) => call[0] === 'error'
      );
      const errorCallback = onCall?.[1];
      act(() => {
        errorCallback?.();
      });

      // Should show error, not loading
      expect(screen.queryByText('wizard.init.loading')).not.toBeInTheDocument();
      expect(screen.getByText('wizard.init.title')).toBeInTheDocument();
    });

    it('should clear loading timeout on unmount', () => {
      const { unmount } = render(<WizardInit />);

      unmount();

      // Advance past 3 seconds - should not cause errors
      act(() => {
        vi.advanceTimersByTime(5000);
      });
    });
  });

  describe('When WebSocket is connected', () => {
    beforeEach(() => {
      (network.isConnected as Mock).mockReturnValue(true);
    });

    it('should render nothing', () => {
      const { container } = render(<WizardInit />);

      expect(container).toBeEmptyDOMElement();
    });

    it('should call setWizardStep with "nick" on mount', () => {
      render(<WizardInit />);

      expect(settingsStore.setWizardStep).toHaveBeenCalledWith('nick');
    });

    it('should not render the error title', () => {
      render(<WizardInit />);

      expect(screen.queryByText('wizard.init.title')).not.toBeInTheDocument();
    });

    it('should not render the retry button', () => {
      render(<WizardInit />);

      expect(screen.queryByText('wizard.init.button.retry')).not.toBeInTheDocument();
    });
  });
});
