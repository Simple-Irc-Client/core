import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import YouTubeThumbnail from '../YouTubeThumbnail';
import * as youtube from '@shared/lib/youtube';

describe('YouTubeThumbnail', () => {
  describe('when no YouTube links are found', () => {
    it('should return null for plain text', () => {
      vi.spyOn(youtube, 'extractYouTubeVideoIds').mockReturnValue([]);

      const { container } = render(<YouTubeThumbnail text="Hello world" />);
      expect(container.innerHTML).toBe('');
    });

    it('should return null for empty text', () => {
      vi.spyOn(youtube, 'extractYouTubeVideoIds').mockReturnValue([]);

      const { container } = render(<YouTubeThumbnail text="" />);
      expect(container.innerHTML).toBe('');
    });
  });

  describe('when YouTube links are found', () => {
    it('should render a thumbnail for a single video', () => {
      vi.spyOn(youtube, 'extractYouTubeVideoIds').mockReturnValue(['dQw4w9WgXcQ']);
      vi.spyOn(youtube, 'getYouTubeThumbnailUrl').mockReturnValue(
        'https://img.youtube.com/vi/dQw4w9WgXcQ/default.jpg'
      );

      render(<YouTubeThumbnail text="Check this out https://youtube.com/watch?v=dQw4w9WgXcQ" />);

      const thumbnail = screen.getByRole('img');
      expect(thumbnail).toBeInTheDocument();
      expect(thumbnail).toHaveAttribute('src', 'https://img.youtube.com/vi/dQw4w9WgXcQ/default.jpg');
      expect(thumbnail).toHaveAttribute('alt', 'YouTube video thumbnail');
    });

    it('should render the thumbnail inside a link to the video', () => {
      vi.spyOn(youtube, 'extractYouTubeVideoIds').mockReturnValue(['dQw4w9WgXcQ']);
      vi.spyOn(youtube, 'getYouTubeThumbnailUrl').mockReturnValue(
        'https://img.youtube.com/vi/dQw4w9WgXcQ/default.jpg'
      );

      render(<YouTubeThumbnail text="https://youtube.com/watch?v=dQw4w9WgXcQ" />);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should render multiple thumbnails for multiple videos', () => {
      vi.spyOn(youtube, 'extractYouTubeVideoIds').mockReturnValue(['video1', 'video2', 'video3']);
      vi.spyOn(youtube, 'getYouTubeThumbnailUrl').mockImplementation(
        (id) => `https://img.youtube.com/vi/${id}/default.jpg`
      );

      render(<YouTubeThumbnail text="Multiple videos" />);

      const thumbnails = screen.getAllByRole('img');
      expect(thumbnails).toHaveLength(3);

      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(3);
      expect(links[0]).toHaveAttribute('href', 'https://www.youtube.com/watch?v=video1');
      expect(links[1]).toHaveAttribute('href', 'https://www.youtube.com/watch?v=video2');
      expect(links[2]).toHaveAttribute('href', 'https://www.youtube.com/watch?v=video3');
    });

    it('should use videoId as key for each thumbnail', () => {
      vi.spyOn(youtube, 'extractYouTubeVideoIds').mockReturnValue(['uniqueId1', 'uniqueId2']);
      vi.spyOn(youtube, 'getYouTubeThumbnailUrl').mockImplementation(
        (id) => `https://img.youtube.com/vi/${id}/default.jpg`
      );

      const { container } = render(<YouTubeThumbnail text="Videos" />);

      // Component should render without key warnings
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('mt-2', 'flex', 'flex-wrap', 'gap-2');
    });
  });

  describe('Unhappy paths', () => {
    it('should skip video when getYouTubeThumbnailUrl returns null', () => {
      vi.spyOn(youtube, 'extractYouTubeVideoIds').mockReturnValue(['validId', 'brokenId']);
      vi.spyOn(youtube, 'getYouTubeThumbnailUrl').mockImplementation((id) =>
        id === 'brokenId' ? null : `https://img.youtube.com/vi/${id}/default.jpg`
      );

      render(<YouTubeThumbnail text="two videos" />);

      const thumbnails = screen.getAllByRole('img');
      expect(thumbnails).toHaveLength(1);
      expect(thumbnails[0]).toHaveAttribute(
        'src',
        'https://img.youtube.com/vi/validId/default.jpg'
      );
    });

    it('should render nothing when all thumbnails return null', () => {
      vi.spyOn(youtube, 'extractYouTubeVideoIds').mockReturnValue(['id1', 'id2']);
      vi.spyOn(youtube, 'getYouTubeThumbnailUrl').mockReturnValue(null);

      render(<YouTubeThumbnail text="no thumbnails" />);

      // Wrapper div is still rendered, but no links/images inside
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });

    it('should not crash when thumbnail image fires onError', () => {
      vi.spyOn(youtube, 'extractYouTubeVideoIds').mockReturnValue(['videoId']);
      vi.spyOn(youtube, 'getYouTubeThumbnailUrl').mockReturnValue(
        'https://img.youtube.com/vi/videoId/default.jpg'
      );

      render(<YouTubeThumbnail text="video" />);

      const img = screen.getByRole('img');
      fireEvent.error(img);

      // Image should still be in the DOM (no error handler removes it)
      expect(img).toBeInTheDocument();
    });
  });
});
