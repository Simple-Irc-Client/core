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

    it('should not handle http URLs', () => {
      const text = 'http://example.com/photo.jpg';
      expect(extractImageUrls(text)).toEqual([]);
    });

    it('should not match extension in query string', () => {
      const text = 'https://evil.com/track?redirect=.jpg';
      expect(extractImageUrls(text)).toEqual([]);
    });

    it('should not match extension mid-path', () => {
      const text = 'https://evil.com/fake.jpg.php';
      expect(extractImageUrls(text)).toEqual([]);
    });

    it('should not match extension in fragment', () => {
      const text = 'https://evil.com/page#section.png';
      expect(extractImageUrls(text)).toEqual([]);
    });

    it('should match URL followed by query string', () => {
      const text = 'https://example.com/photo.jpg?token=abc123';
      expect(extractImageUrls(text)).toEqual(['https://example.com/photo.jpg?token=abc123']);
    });

    it('should block localhost images', () => {
      expect(extractImageUrls('https://localhost/photo.jpg')).toEqual([]);
      expect(extractImageUrls('https://localhost:8080/photo.jpg')).toEqual([]);
    });

    it('should block 127.0.0.1 images', () => {
      expect(extractImageUrls('https://127.0.0.1/photo.jpg')).toEqual([]);
      expect(extractImageUrls('https://127.0.0.1:3000/photo.png')).toEqual([]);
    });

    it('should block private IP range images', () => {
      expect(extractImageUrls('https://10.0.0.1/photo.jpg')).toEqual([]);
      expect(extractImageUrls('https://192.168.1.1/photo.png')).toEqual([]);
      expect(extractImageUrls('https://172.16.0.1/photo.gif')).toEqual([]);
    });

    it('should block link-local IP images', () => {
      expect(extractImageUrls('https://169.254.1.1/photo.jpg')).toEqual([]);
    });

    it('should block IPv6 loopback images', () => {
      expect(extractImageUrls('https://[::1]/photo.jpg')).toEqual([]);
    });

    it('should allow public IP images', () => {
      expect(extractImageUrls('https://93.184.216.34/photo.jpg')).toEqual([
        'https://93.184.216.34/photo.jpg',
      ]);
    });

    it('should filter private hosts from mixed URLs', () => {
      const text = 'https://example.com/a.jpg https://192.168.1.1/b.png https://cdn.example.com/c.gif';
      const result = extractImageUrls(text);
      expect(result).toEqual([
        'https://example.com/a.jpg',
        'https://cdn.example.com/c.gif',
      ]);
    });
  });
});
