import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import NotConnected from '../NotConnected';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('NotConnected', () => {
  it('should render the not connected message', () => {
    render(<NotConnected />);

    expect(screen.getByText('main.chat.notConnected')).toBeInTheDocument();
  });

  it('should have role="status" and aria-live="polite"', () => {
    render(<NotConnected />);

    const statusEl = screen.getByRole('status');
    expect(statusEl).toHaveAttribute('aria-live', 'polite');
  });

  it('should have aria-hidden on the WifiOff icon', () => {
    const { container } = render(<NotConnected />);

    const icon = container.querySelector('svg.lucide-wifi-off');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});
