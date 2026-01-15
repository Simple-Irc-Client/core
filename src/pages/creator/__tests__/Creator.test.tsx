import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Creator from '../Creator';
import * as settingsStore from '../../../store/settings';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock child components
vi.mock('../CreatorNick', () => ({
  default: () => <div data-testid="creator-nick">CreatorNick</div>,
}));

vi.mock('../CreatorServer', () => ({
  default: () => <div data-testid="creator-server">CreatorServer</div>,
}));

vi.mock('../CreatorPassword', () => ({
  default: () => <div data-testid="creator-password">CreatorPassword</div>,
}));

vi.mock('../CreatorLoading', () => ({
  default: () => <div data-testid="creator-loading">CreatorLoading</div>,
}));

vi.mock('../CreatorChannelList', () => ({
  default: () => <div data-testid="creator-channel-list">CreatorChannelList</div>,
}));

describe('Creator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMocks = (creatorStep: string) => {
    vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (selector: any) => selector({ creatorStep })
    );
  };

  describe('Step rendering', () => {
    it('should render CreatorNick when step is "nick"', () => {
      setupMocks('nick');

      render(<Creator />);

      expect(screen.getByTestId('creator-nick')).toBeInTheDocument();
      expect(screen.queryByTestId('creator-server')).not.toBeInTheDocument();
      expect(screen.queryByTestId('creator-password')).not.toBeInTheDocument();
      expect(screen.queryByTestId('creator-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('creator-channel-list')).not.toBeInTheDocument();
    });

    it('should render CreatorServer when step is "server"', () => {
      setupMocks('server');

      render(<Creator />);

      expect(screen.queryByTestId('creator-nick')).not.toBeInTheDocument();
      expect(screen.getByTestId('creator-server')).toBeInTheDocument();
      expect(screen.queryByTestId('creator-password')).not.toBeInTheDocument();
      expect(screen.queryByTestId('creator-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('creator-channel-list')).not.toBeInTheDocument();
    });

    it('should render CreatorPassword when step is "password"', () => {
      setupMocks('password');

      render(<Creator />);

      expect(screen.queryByTestId('creator-nick')).not.toBeInTheDocument();
      expect(screen.queryByTestId('creator-server')).not.toBeInTheDocument();
      expect(screen.getByTestId('creator-password')).toBeInTheDocument();
      expect(screen.queryByTestId('creator-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('creator-channel-list')).not.toBeInTheDocument();
    });

    it('should render CreatorLoading when step is "loading"', () => {
      setupMocks('loading');

      render(<Creator />);

      expect(screen.queryByTestId('creator-nick')).not.toBeInTheDocument();
      expect(screen.queryByTestId('creator-server')).not.toBeInTheDocument();
      expect(screen.queryByTestId('creator-password')).not.toBeInTheDocument();
      expect(screen.getByTestId('creator-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('creator-channel-list')).not.toBeInTheDocument();
    });

    it('should render CreatorChannelList when step is "channels"', () => {
      setupMocks('channels');

      render(<Creator />);

      expect(screen.queryByTestId('creator-nick')).not.toBeInTheDocument();
      expect(screen.queryByTestId('creator-server')).not.toBeInTheDocument();
      expect(screen.queryByTestId('creator-password')).not.toBeInTheDocument();
      expect(screen.queryByTestId('creator-loading')).not.toBeInTheDocument();
      expect(screen.getByTestId('creator-channel-list')).toBeInTheDocument();
    });

    it('should render nothing when step is unknown', () => {
      setupMocks('unknown');

      render(<Creator />);

      expect(screen.queryByTestId('creator-nick')).not.toBeInTheDocument();
      expect(screen.queryByTestId('creator-server')).not.toBeInTheDocument();
      expect(screen.queryByTestId('creator-password')).not.toBeInTheDocument();
      expect(screen.queryByTestId('creator-loading')).not.toBeInTheDocument();
      expect(screen.queryByTestId('creator-channel-list')).not.toBeInTheDocument();
    });
  });

  describe('Layout classes', () => {
    it('should use max-w-screen-md class when step is "channels"', () => {
      setupMocks('channels');

      const { container } = render(<Creator />);

      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv).toHaveClass('max-w-screen-md');
      expect(outerDiv).not.toHaveClass('max-w-screen-sm');
    });

    it('should use max-w-screen-sm class when step is "nick"', () => {
      setupMocks('nick');

      const { container } = render(<Creator />);

      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv).toHaveClass('max-w-screen-sm');
      expect(outerDiv).not.toHaveClass('max-w-screen-md');
    });

    it('should use max-w-screen-sm class when step is "server"', () => {
      setupMocks('server');

      const { container } = render(<Creator />);

      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv).toHaveClass('max-w-screen-sm');
    });

    it('should use max-w-screen-sm class when step is "password"', () => {
      setupMocks('password');

      const { container } = render(<Creator />);

      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv).toHaveClass('max-w-screen-sm');
    });

    it('should use max-w-screen-sm class when step is "loading"', () => {
      setupMocks('loading');

      const { container } = render(<Creator />);

      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv).toHaveClass('max-w-screen-sm');
    });
  });

  describe('Step transitions', () => {
    it('should update displayed component when step changes', () => {
      setupMocks('nick');
      const { rerender } = render(<Creator />);

      expect(screen.getByTestId('creator-nick')).toBeInTheDocument();

      // Change step to server
      setupMocks('server');
      rerender(<Creator />);

      expect(screen.queryByTestId('creator-nick')).not.toBeInTheDocument();
      expect(screen.getByTestId('creator-server')).toBeInTheDocument();
    });

    it('should update layout class when transitioning to channels step', () => {
      setupMocks('nick');
      const { container, rerender } = render(<Creator />);

      const outerDiv = container.firstChild as HTMLElement;
      expect(outerDiv).toHaveClass('max-w-screen-sm');

      // Change step to channels
      setupMocks('channels');
      rerender(<Creator />);

      expect(outerDiv).toHaveClass('max-w-screen-md');
    });
  });
});
