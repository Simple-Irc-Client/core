import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ImagesPreview from '../ImagesPreview';
import * as image from '@shared/lib/image';

describe('ImagesPreview', () => {
  describe('when no image URLs are found', () => {
    it('should return null for plain text', () => {
      vi.spyOn(image, 'extractImageUrls').mockReturnValue([]);

      const { container } = render(<ImagesPreview text="Hello world" />);
      expect(container.innerHTML).toBe('');
    });

    it('should return null for empty text', () => {
      vi.spyOn(image, 'extractImageUrls').mockReturnValue([]);

      const { container } = render(<ImagesPreview text="" />);
      expect(container.innerHTML).toBe('');
    });
  });

  describe('when image URLs are found', () => {
    it('should render a preview for a single image', () => {
      vi.spyOn(image, 'extractImageUrls').mockReturnValue([
        'https://example.com/image.png',
      ]);

      render(<ImagesPreview text="Check this image https://example.com/image.png" />);

      const preview = screen.getByRole('img');
      expect(preview).toBeInTheDocument();
      expect(preview).toHaveAttribute('src', 'https://example.com/image.png');
      expect(preview).toHaveAttribute('alt', 'Image thumbnail');
    });

    it('should render the image inside a link to the original URL', () => {
      vi.spyOn(image, 'extractImageUrls').mockReturnValue([
        'https://example.com/photo.jpg',
      ]);

      render(<ImagesPreview text="https://example.com/photo.jpg" />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://example.com/photo.jpg');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should render multiple previews for multiple images', () => {
      vi.spyOn(image, 'extractImageUrls').mockReturnValue([
        'https://example.com/image1.png',
        'https://example.com/image2.jpg',
        'https://example.com/image3.gif',
      ]);

      render(<ImagesPreview text="Multiple images" />);

      const previews = screen.getAllByRole('img');
      expect(previews).toHaveLength(3);

      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(3);
      expect(links[0]).toHaveAttribute('href', 'https://example.com/image1.png');
      expect(links[1]).toHaveAttribute('href', 'https://example.com/image2.jpg');
      expect(links[2]).toHaveAttribute('href', 'https://example.com/image3.gif');
    });

    it('should use URL as key for each preview', () => {
      vi.spyOn(image, 'extractImageUrls').mockReturnValue([
        'https://example.com/unique1.png',
        'https://example.com/unique2.png',
      ]);

      const { container } = render(<ImagesPreview text="Images" />);

      // Component should render without key warnings
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('mt-2', 'flex', 'flex-wrap', 'gap-2');
    });

    it('should handle image URLs with query parameters', () => {
      vi.spyOn(image, 'extractImageUrls').mockReturnValue([
        'https://example.com/image.png?size=large&quality=high',
      ]);

      render(<ImagesPreview text="Image with params" />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute(
        'href',
        'https://example.com/image.png?size=large&quality=high'
      );
    });
  });
});
