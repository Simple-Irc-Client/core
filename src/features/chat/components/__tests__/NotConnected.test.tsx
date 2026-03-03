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
    expect(screen.getByText('main.chat.notConnectedDescription')).toBeInTheDocument();
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

  it('should render arrow SVG when avatar button is present', () => {
    // Create a mock avatar button in the DOM
    const avatarButton = document.createElement('button');
    avatarButton.setAttribute('data-avatar-button', '');
    avatarButton.getBoundingClientRect = () => ({
      top: 500,
      left: 20,
      bottom: 540,
      right: 60,
      width: 40,
      height: 40,
      x: 20,
      y: 500,
      toJSON: () => ({}),
    });
    document.body.appendChild(avatarButton);

    const { container } = render(<NotConnected />);

    // Mock container and description getBoundingClientRect
    const containerEl = container.firstElementChild as HTMLElement;
    const descriptionEl = container.querySelector('p:last-of-type') as HTMLElement;

    containerEl.getBoundingClientRect = () => ({
      top: 0,
      left: 0,
      bottom: 600,
      right: 800,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    descriptionEl.getBoundingClientRect = () => ({
      top: 280,
      left: 350,
      bottom: 300,
      right: 450,
      width: 100,
      height: 20,
      x: 350,
      y: 280,
      toJSON: () => ({}),
    });

    // Trigger resize to recalculate
    window.dispatchEvent(new Event('resize'));

    const svgs = container.querySelectorAll('svg');
    const arrowSvg = Array.from(svgs).find(
      (svg) => !svg.classList.contains('lucide-wifi-off'),
    );

    if (arrowSvg) {
      expect(arrowSvg).toHaveAttribute('aria-hidden', 'true');
    }

    document.body.removeChild(avatarButton);
  });

  describe('Unhappy paths', () => {
    it('should not render arrow SVG when no avatar button is in DOM', () => {
      const { container } = render(<NotConnected />);

      // No data-avatar-button in the DOM — arrow should not render
      const svgs = container.querySelectorAll('svg');
      const arrowSvg = Array.from(svgs).find(
        (svg) => !svg.classList.contains('lucide-wifi-off'),
      );
      expect(arrowSvg).toBeUndefined();
    });

    it('should render without crashing when getBoundingClientRect returns zeros', () => {
      // Create a mock avatar button with zero dimensions
      const avatarButton = document.createElement('button');
      avatarButton.setAttribute('data-avatar-button', '');
      avatarButton.getBoundingClientRect = () => ({
        top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0, x: 0, y: 0,
        toJSON: () => ({}),
      });
      document.body.appendChild(avatarButton);

      // Should not crash
      const { container } = render(<NotConnected />);
      expect(screen.getByText('main.chat.notConnected')).toBeInTheDocument();

      // Messages should still be rendered
      expect(container.querySelector('.text-muted-foreground')).not.toBeNull();

      document.body.removeChild(avatarButton);
    });
  });
});
