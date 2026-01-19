import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Typing from '../Typing';
import * as currentStore from '@features/chat/store/current';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('Typing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMocks = (typing: string[] = []) => {
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
});
