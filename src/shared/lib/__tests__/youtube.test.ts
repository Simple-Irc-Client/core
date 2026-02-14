import { describe, expect, it } from 'vitest';
import { extractYouTubeVideoId, extractYouTubeVideoIds, getYouTubeThumbnailUrl } from '../youtube';

describe('youtube utils', () => {
  describe('extractYouTubeVideoIds', () => {
    it('should extract multiple video IDs from text', () => {
      const text = 'Check these: https://youtu.be/dQw4w9WgXcQ and https://youtube.com/watch?v=abc123DEF_-';
      const result = extractYouTubeVideoIds(text);
      expect(result).toHaveLength(2);
      expect(result).toContain('dQw4w9WgXcQ');
      expect(result).toContain('abc123DEF_-');
    });

    it('should extract multiple video IDs of different formats', () => {
      const text = 'https://youtu.be/aaaaaaaaaaa https://youtube.com/v/bbbbbbbbbbb https://youtube.com/watch?v=ccccccccccc';
      const result = extractYouTubeVideoIds(text);
      expect(result).toHaveLength(3);
      expect(result).toContain('aaaaaaaaaaa');
      expect(result).toContain('bbbbbbbbbbb');
      expect(result).toContain('ccccccccccc');
    });

    it('should not include duplicate video IDs', () => {
      const text = 'https://youtu.be/dQw4w9WgXcQ and https://youtube.com/watch?v=dQw4w9WgXcQ';
      expect(extractYouTubeVideoIds(text)).toEqual(['dQw4w9WgXcQ']);
    });

    it('should extract video ID from youtube.com/shorts/ format', () => {
      const text = 'https://youtube.com/shorts/dQw4w9WgXcQ';
      expect(extractYouTubeVideoIds(text)).toEqual(['dQw4w9WgXcQ']);
    });

    it('should extract shorts and regular videos from same text', () => {
      const text = 'https://youtube.com/shorts/aaaaaaaaaaa https://youtu.be/bbbbbbbbbbb';
      const result = extractYouTubeVideoIds(text);
      expect(result).toHaveLength(2);
      expect(result).toContain('aaaaaaaaaaa');
      expect(result).toContain('bbbbbbbbbbb');
    });

    it('should return empty array for text without YouTube URLs', () => {
      expect(extractYouTubeVideoIds('Hello, world!')).toEqual([]);
      expect(extractYouTubeVideoIds('')).toEqual([]);
    });
  });

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

    it('should extract video ID from youtube.com/shorts/ format', () => {
      expect(extractYouTubeVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
      expect(extractYouTubeVideoId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
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
