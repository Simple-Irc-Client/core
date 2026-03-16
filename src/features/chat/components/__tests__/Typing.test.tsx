import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Typing from '../Typing';
import * as currentStore from '@features/chat/store/current';
import * as settingsStore from '@features/settings/store/settings';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, string>) =>
      opts ? Object.values(opts).join(', ') + ' ' + key : key,
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));

describe('Typing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMocks = (typing: string[] = [], isConnected = true) => {
    vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
      selector({
        isConnected,
      } as ReturnType<typeof settingsStore.useSettingsStore.getState>)
    );
    vi.spyOn(currentStore, 'useCurrentStore').mockImplementation((selector) =>
      selector({
        topic: '',
        messages: [],
        users: [],
        typing,
        setUpdateTopic: vi.fn(),
        setUpdateMessages: vi.fn(),
        setUpdateUsers: vi.fn(),
        setUpdateTyping: vi.fn(),
        setClearAll: vi.fn(),
      })
    );
  };

  describe('Basic rendering', () => {
    it('should render empty when no one is typing', () => {
      setupMocks([]);

      const { container } = render(<Typing />);

      expect(container.querySelector('.text-xs')).toBeInTheDocument();
      expect(container.textContent).toBe('');
    });

    it('should render single user typing', () => {
      setupMocks(['Alice']);

      render(<Typing />);

      expect(screen.getByText(/Alice/)).toBeInTheDocument();
      expect(screen.getByText(/main.user-typing/)).toBeInTheDocument();
    });

    it('should render multiple users typing with comma separator', () => {
      setupMocks(['Alice', 'Bob']);

      render(<Typing />);

      expect(screen.getByText(/Alice, Bob/)).toBeInTheDocument();
      expect(screen.getByText(/main.user-typing/)).toBeInTheDocument();
    });

    it('should render three users typing', () => {
      setupMocks(['Alice', 'Bob', 'Charlie']);

      render(<Typing />);

      expect(screen.getByText(/Alice, Bob, Charlie/)).toBeInTheDocument();
      expect(screen.getByText(/main.user-typing/)).toBeInTheDocument();
    });
  });

  describe('Translation', () => {
    it('should display translation key for typing indicator', () => {
      setupMocks(['User1']);

      render(<Typing />);

      expect(screen.getByText(/main.user-typing/)).toBeInTheDocument();
    });
  });

  describe('Empty nick filtering', () => {
    it('should not render typing indicator when array contains only empty strings', () => {
      setupMocks(['']);

      const { container } = render(<Typing />);

      expect(container.textContent).toBe('');
    });

    it('should filter out empty strings and render valid nicks', () => {
      setupMocks(['', 'Alice', '']);

      render(<Typing />);

      expect(screen.getByText(/Alice/)).toBeInTheDocument();
      expect(screen.getByText(/main.user-typing/)).toBeInTheDocument();
    });

    it('should not render typing indicator when array contains only whitespace strings', () => {
      setupMocks([' ', '  ']);

      const { container } = render(<Typing />);

      expect(container.textContent).toBe('');
    });

    it('should filter out whitespace-only strings and render valid nicks', () => {
      setupMocks([' ', 'Alice', '  ']);

      render(<Typing />);

      expect(screen.getByText(/Alice/)).toBeInTheDocument();
      expect(screen.getByText(/main.user-typing/)).toBeInTheDocument();
    });
  });

  describe('Disconnected state', () => {
    it('should not render typing indicator when disconnected even if typing array has entries', () => {
      setupMocks(['Alice', 'Bob'], false);

      const { container } = render(<Typing />);

      expect(container.textContent).toBe('');
    });

    it('should not render typing indicator when disconnected with single user', () => {
      setupMocks(['Alice'], false);

      const { container } = render(<Typing />);

      expect(container.textContent).toBe('');
    });
  });

  describe('Unhappy paths', () => {
    it('should render all nicks without crash when many users are typing', () => {
      const manyNicks = Array.from({ length: 25 }, (_, i) => `User${i}`);
      setupMocks(manyNicks);

      render(<Typing />);

      expect(screen.getByText(/User0/)).toBeInTheDocument();
      expect(screen.getByText(/User24/)).toBeInTheDocument();
      expect(screen.getByText(/main.user-typing/)).toBeInTheDocument();
    });

    it('should render nicks with IRC special characters safely', () => {
      setupMocks(['[nick]', 'nick|away', 'nick{test}', String.raw`nick\backslash`]);

      render(<Typing />);

      expect(screen.getByText(/\[nick\]/)).toBeInTheDocument();
      expect(screen.getByText(/nick\|away/)).toBeInTheDocument();
      expect(screen.getByText(/main.user-typing/)).toBeInTheDocument();
    });
  });
});
