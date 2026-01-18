import { describe, expect, it } from 'vitest';
import { extractImageUrls } from '../image';

describe('image utils', () => {
  describe('extractImageUrls', () => {
    it('should extract jpg URLs', () => {
      const text = 'Check this image: https://example.com/photo.jpg';
      expect(extractImageUrls(text)).toEqual(['https://example.com/photo.jpg']);
    });

    it('should extract jpeg URLs', () => {
      const text = 'https://example.com/photo.jpeg';
      expect(extractImageUrls(text)).toEqual(['https://example.com/photo.jpeg']);
    });

    it('should extract png URLs', () => {
      const text = 'https://example.com/image.png';
      expect(extractImageUrls(text)).toEqual(['https://example.com/image.png']);
    });

    it('should extract gif URLs', () => {
      const text = 'https://example.com/animation.gif';
      expect(extractImageUrls(text)).toEqual(['https://example.com/animation.gif']);
    });

    it('should extract multiple image URLs', () => {
      const text = 'https://example.com/a.jpg https://example.com/b.png https://example.com/c.gif';
      const result = extractImageUrls(text);
      expect(result).toHaveLength(3);
      expect(result).toContain('https://example.com/a.jpg');
      expect(result).toContain('https://example.com/b.png');
      expect(result).toContain('https://example.com/c.gif');
    });

    it('should handle URLs with query parameters', () => {
      const text = 'https://example.com/photo.jpg?size=large&quality=high';
      expect(extractImageUrls(text)).toEqual(['https://example.com/photo.jpg?size=large&quality=high']);
    });

    it('should be case insensitive for extensions', () => {
      const text = 'https://example.com/a.JPG https://example.com/b.PNG https://example.com/c.GIF';
      const result = extractImageUrls(text);
      expect(result).toHaveLength(3);
    });

    it('should not include duplicate URLs', () => {
      const text = 'https://example.com/photo.jpg and https://example.com/photo.jpg again';
      expect(extractImageUrls(text)).toEqual(['https://example.com/photo.jpg']);
    });

    it('should return empty array for text without image URLs', () => {
      expect(extractImageUrls('Hello, world!')).toEqual([]);
      expect(extractImageUrls('')).toEqual([]);
      expect(extractImageUrls('https://example.com/file.pdf')).toEqual([]);
    });

    it('should handle http URLs', () => {
      const text = 'http://example.com/photo.jpg';
      expect(extractImageUrls(text)).toEqual(['http://example.com/photo.jpg']);
    });
  });
});
