import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Avatar from '../Avatar';

describe('Avatar', () => {
  describe('Basic rendering', () => {
    it('should display fallback letter when no src is provided', () => {
      render(<Avatar alt="TestUser" fallbackLetter="T" />);

      expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('should display image when src is provided', () => {
      render(
        <Avatar
          src="https://example.com/avatar.png"
          alt="TestUser"
          fallbackLetter="T"
        />
      );

      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'https://example.com/avatar.png');
      expect(img).toHaveAttribute('alt', 'TestUser');
    });

    it('should apply custom className', () => {
      const { container } = render(
        <Avatar alt="TestUser" fallbackLetter="T" className="h-10 w-10" />
      );

      const avatarDiv = container.firstChild;
      expect(avatarDiv).toHaveClass('h-10', 'w-10');
    });
  });

  describe('Error handling', () => {
    it('should display fallback letter when image fails to load', () => {
      render(
        <Avatar
          src="https://example.com/invalid-avatar.png"
          alt="TestUser"
          fallbackLetter="T"
        />
      );

      // Initially shows the image
      const img = screen.getByRole('img');
      expect(img).toBeInTheDocument();

      // Simulate image load error
      fireEvent.error(img);

      // After error, should show fallback letter
      expect(screen.getByText('T')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('should display fallback letter when avatar returns 404', () => {
      render(
        <Avatar
          src="https://example.com/missing.png"
          alt="User404"
          fallbackLetter="U"
        />
      );

      const img = screen.getByRole('img');
      fireEvent.error(img);

      expect(screen.getByText('U')).toBeInTheDocument();
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('should handle multiple error events gracefully', () => {
      render(
        <Avatar
          src="https://example.com/broken.png"
          alt="TestUser"
          fallbackLetter="T"
        />
      );

      const img = screen.getByRole('img');
      fireEvent.error(img);

      // After first error, fallback should be shown
      expect(screen.getByText('T')).toBeInTheDocument();

      // Component should remain stable (no errors thrown)
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });
  });

  describe('Context menu', () => {
    it('should call onContextMenu when right-clicked', () => {
      const mockContextMenu = vi.fn();
      const { container } = render(
        <Avatar
          alt="TestUser"
          fallbackLetter="T"
          onContextMenu={mockContextMenu}
        />
      );

      const avatarDiv = container.firstChild as HTMLElement;
      fireEvent.contextMenu(avatarDiv);

      expect(mockContextMenu).toHaveBeenCalledTimes(1);
    });

    it('should call onContextMenu when right-clicked on image', () => {
      const mockContextMenu = vi.fn();
      const { container } = render(
        <Avatar
          src="https://example.com/avatar.png"
          alt="TestUser"
          fallbackLetter="T"
          onContextMenu={mockContextMenu}
        />
      );

      const avatarDiv = container.firstChild as HTMLElement;
      fireEvent.contextMenu(avatarDiv);

      expect(mockContextMenu).toHaveBeenCalledTimes(1);
    });
  });

  describe('Styling', () => {
    it('should have rounded-full class for circular avatar', () => {
      const { container } = render(
        <Avatar alt="TestUser" fallbackLetter="T" />
      );

      const avatarDiv = container.firstChild;
      expect(avatarDiv).toHaveClass('rounded-full');
    });

    it('should have overflow-hidden to clip image', () => {
      const { container } = render(
        <Avatar alt="TestUser" fallbackLetter="T" />
      );

      const avatarDiv = container.firstChild;
      expect(avatarDiv).toHaveClass('overflow-hidden');
    });

    it('should render fallback with correct styling', () => {
      render(<Avatar alt="TestUser" fallbackLetter="T" />);

      const fallback = screen.getByText('T');
      expect(fallback).toHaveClass('flex', 'items-center', 'justify-center');
    });
  });
});
