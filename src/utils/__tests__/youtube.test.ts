import { describe, expect, it } from 'vitest';
import { extractYouTubeVideoId, getYouTubeThumbnailUrl } from '../youtube';

describe('youtube utils', () => {
  describe('extractYouTubeVideoId', () => {
    it('should extract video ID from youtube.com/watch?v= format', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeVideoId('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeVideoId('http://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from youtube.com/watch with additional query params', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120')).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeVideoId('https://www.youtube.com/watch?list=PLtest&v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from youtube.com/v/ format', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/v/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeVideoId('https://youtube.com/v/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from youtu.be/ format', () => {
      expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeVideoId('http://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from text containing YouTube URL', () => {
      expect(extractYouTubeVideoId('Check out this video: https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=abc123DEF_- is cool')).toBe('abc123DEF_-');
    });

    it('should handle video IDs with underscores and hyphens', () => {
      expect(extractYouTubeVideoId('https://youtu.be/abc_123-DEF')).toBe('abc_123-DEF');
      expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=_-_abc123_-_')).toBe('_-_abc123_-');
    });

    it('should return null for non-YouTube URLs', () => {
      expect(extractYouTubeVideoId('https://example.com/video')).toBeNull();
      expect(extractYouTubeVideoId('https://vimeo.com/123456789')).toBeNull();
    });

    it('should return null for text without YouTube URLs', () => {
      expect(extractYouTubeVideoId('Hello, world!')).toBeNull();
      expect(extractYouTubeVideoId('')).toBeNull();
    });

    it('should return null for URLs with video ID too short', () => {
      expect(extractYouTubeVideoId('https://youtube.com/watch?v=short')).toBeNull();
    });

    it('should extract first 11 characters from long video ID strings', () => {
      expect(extractYouTubeVideoId('https://youtube.com/watch?v=toolongvideoid123')).toBe('toolongvide');
    });
  });

  describe('getYouTubeThumbnailUrl', () => {
    it('should generate correct thumbnail URL', () => {
      expect(getYouTubeThumbnailUrl('dQw4w9WgXcQ')).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/default.jpg');
      expect(getYouTubeThumbnailUrl('abc123DEF_-')).toBe('https://img.youtube.com/vi/abc123DEF_-/default.jpg');
    });
  });
});
