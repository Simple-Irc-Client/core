import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WizardPage from '../WizardPage';
import * as settingsStore from '@features/settings/store/settings';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

// Mock child components - paths are relative to the source file being imported
vi.mock('../../components/WizardNick', () => ({
  default: () => <div data-testid="wizard-nick">WizardPageNick</div>,
}));

vi.mock('../../components/WizardServer', () => ({
  default: () => <div data-testid="wizard-server">WizardPageServer</div>,
}));

vi.mock('../../components/WizardPassword', () => ({
  default: () => <div data-testid="wizard-password">WizardPagePassword</div>,
}));

vi.mock('../../components/WizardLoading', () => ({
  default: () => <div data-testid="wizard-loading">WizardPageLoading</div>,
}));

vi.mock('../../components/WizardChannelList', () => ({
  default: () => <div data-testid="wizard-channel-list">WizardPageChannelList</div>,
}));

const getContentDiv = (container: HTMLElement): HTMLElement => {
  // Root: div.relative.h-screen > [background div, content div]
  const root = container.firstChild as HTMLElement;
  return root.children[1] as HTMLElement;
};

describe('WizardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMocks = (wizardStep: string, overrides: Record<string, unknown> = {}) => {
    vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (selector: any) => selector({ wizardStep, isWizardHintDismissed: true, ...overrides })
    );
  };

  describe('Step rendering', () => {
    it('should render WizardPageNick when step is "nick"', () => {
      setupMocks('nick');

      render(<WizardPage />);

      expect(screen.getByTestId('wizard-nick')).toBeInTheDocument();
      expect(screen.queryByTestId('wizard-server')).not.toBeInTheDocument();
      expect(screen.queryByTestId('wizard-password')).not.toBeInTheDocument();
      expect(screen.queryByTestId('wizard-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('wizard-channel-list')).not.toBeInTheDocument();
    });

    it('should render WizardPageServer when step is "server"', () => {
      setupMocks('server');

      render(<WizardPage />);

      expect(screen.queryByTestId('wizard-nick')).not.toBeInTheDocument();
      expect(screen.getByTestId('wizard-server')).toBeInTheDocument();
      expect(screen.queryByTestId('wizard-password')).not.toBeInTheDocument();
      expect(screen.queryByTestId('wizard-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('wizard-channel-list')).not.toBeInTheDocument();
    });

    it('should render WizardPagePassword when step is "password"', () => {
      setupMocks('password');

      render(<WizardPage />);

      expect(screen.queryByTestId('wizard-nick')).not.toBeInTheDocument();
      expect(screen.queryByTestId('wizard-server')).not.toBeInTheDocument();
      expect(screen.getByTestId('wizard-password')).toBeInTheDocument();
      expect(screen.queryByTestId('wizard-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('wizard-channel-list')).not.toBeInTheDocument();
    });

    it('should render WizardPageLoading when step is "loading"', () => {
      setupMocks('loading');

      render(<WizardPage />);

      expect(screen.queryByTestId('wizard-nick')).not.toBeInTheDocument();
      expect(screen.queryByTestId('wizard-server')).not.toBeInTheDocument();
      expect(screen.queryByTestId('wizard-password')).not.toBeInTheDocument();
      expect(screen.getByTestId('wizard-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('wizard-channel-list')).not.toBeInTheDocument();
    });

    it('should render WizardPageChannelList when step is "channels"', () => {
      setupMocks('channels');

      render(<WizardPage />);

      expect(screen.queryByTestId('wizard-nick')).not.toBeInTheDocument();
      expect(screen.queryByTestId('wizard-server')).not.toBeInTheDocument();
      expect(screen.queryByTestId('wizard-password')).not.toBeInTheDocument();
      expect(screen.queryByTestId('wizard-loading')).not.toBeInTheDocument();
      expect(screen.getByTestId('wizard-channel-list')).toBeInTheDocument();
    });

    it('should render nothing when step is unknown', () => {
      setupMocks('unknown');

      render(<WizardPage />);

      expect(screen.queryByTestId('wizard-nick')).not.toBeInTheDocument();
      expect(screen.queryByTestId('wizard-server')).not.toBeInTheDocument();
      expect(screen.queryByTestId('wizard-password')).not.toBeInTheDocument();
      expect(screen.queryByTestId('wizard-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('wizard-channel-list')).not.toBeInTheDocument();
    });
  });

  describe('Layout classes', () => {
    it('should use max-w-screen-md class when step is "channels"', () => {
      setupMocks('channels');

      const { container } = render(<WizardPage />);

      const contentDiv = getContentDiv(container);
      expect(contentDiv).toHaveClass('max-w-screen-md');
      expect(contentDiv).not.toHaveClass('max-w-screen-sm');
    });

    it('should use max-w-screen-sm class when step is "nick"', () => {
      setupMocks('nick');

      const { container } = render(<WizardPage />);

      const contentDiv = getContentDiv(container);
      expect(contentDiv).toHaveClass('max-w-screen-sm');
      expect(contentDiv).not.toHaveClass('max-w-screen-md');
    });

    it('should use max-w-screen-sm class when step is "server"', () => {
      setupMocks('server');

      const { container } = render(<WizardPage />);

      const contentDiv = getContentDiv(container);
      expect(contentDiv).toHaveClass('max-w-screen-sm');
    });

    it('should use max-w-screen-sm class when step is "password"', () => {
      setupMocks('password');

      const { container } = render(<WizardPage />);

      const contentDiv = getContentDiv(container);
      expect(contentDiv).toHaveClass('max-w-screen-sm');
    });

    it('should use max-w-screen-sm class when step is "loading"', () => {
      setupMocks('loading');

      const { container } = render(<WizardPage />);

      const contentDiv = getContentDiv(container);
      expect(contentDiv).toHaveClass('max-w-screen-sm');
    });
  });

  describe('Step transitions', () => {
    it('should update displayed component when step changes', () => {
      setupMocks('nick');
      const { rerender } = render(<WizardPage />);

      expect(screen.getByTestId('wizard-nick')).toBeInTheDocument();

      // Change step to server
      setupMocks('server');
      rerender(<WizardPage />);

      expect(screen.queryByTestId('wizard-nick')).not.toBeInTheDocument();
      expect(screen.getByTestId('wizard-server')).toBeInTheDocument();
    });

    it('should update layout class when transitioning to channels step', () => {
      setupMocks('nick');
      const { container, rerender } = render(<WizardPage />);

      const contentDiv = getContentDiv(container);
      expect(contentDiv).toHaveClass('max-w-screen-sm');

      // Change step to channels
      setupMocks('channels');
      rerender(<WizardPage />);

      expect(contentDiv).toHaveClass('max-w-screen-md');
    });
  });

  describe('Wizard hint', () => {
    it('should show hint on nick step when not dismissed', () => {
      setupMocks('nick', { isWizardHintDismissed: false });

      render(<WizardPage />);

      expect(screen.getByText('wizard.hint.message')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'wizard.hint.dismiss' })).toBeInTheDocument();
    });

    it('should not show hint on nick step when dismissed', () => {
      setupMocks('nick', { isWizardHintDismissed: true });

      render(<WizardPage />);

      expect(screen.queryByText('wizard.hint.message')).not.toBeInTheDocument();
    });

    it('should not show hint on non-nick steps', () => {
      setupMocks('server', { isWizardHintDismissed: false });

      render(<WizardPage />);

      expect(screen.queryByText('wizard.hint.message')).not.toBeInTheDocument();
    });

    it('should call setWizardHintDismissed when dismiss button is clicked', async () => {
      const setWizardHintDismissedSpy = vi.spyOn(settingsStore, 'setWizardHintDismissed').mockImplementation(() => {});
      setupMocks('nick', { isWizardHintDismissed: false });

      render(<WizardPage />);

      await userEvent.click(screen.getByRole('button', { name: 'wizard.hint.dismiss' }));

      expect(setWizardHintDismissedSpy).toHaveBeenCalledOnce();
    });

    it('should have accessible role="status" on hint container', () => {
      setupMocks('nick', { isWizardHintDismissed: false });

      render(<WizardPage />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Unhappy paths', () => {
    it('should render nothing when wizardStep is empty string', () => {
      setupMocks('');

      render(<WizardPage />);

      expect(screen.queryByTestId('wizard-nick')).not.toBeInTheDocument();
      expect(screen.queryByTestId('wizard-server')).not.toBeInTheDocument();
      expect(screen.queryByTestId('wizard-password')).not.toBeInTheDocument();
      expect(screen.queryByTestId('wizard-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('wizard-channel-list')).not.toBeInTheDocument();
    });
  });
});
