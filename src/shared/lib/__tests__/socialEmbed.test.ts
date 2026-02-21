import { describe, expect, it } from 'vitest';
import { extractSocialEmbeds } from '../socialEmbed';

describe('socialEmbed', () => {
  describe('X/Twitter extraction — valid URLs', () => {
    it('should extract tweet from x.com URL', () => {
      const result = extractSocialEmbeds('https://x.com/user/status/123456789', false);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        platform: 'x',
        embedUrl: 'https://platform.twitter.com/embed/Tweet.html?id=123456789',
        originalUrl: 'https://x.com/user/status/123456789',
      });
    });

    it('should extract tweet from twitter.com URL', () => {
      const result = extractSocialEmbeds('https://twitter.com/user/status/123456789', false);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ platform: 'x' });
      expect(result[0]).toHaveProperty('embedUrl', expect.stringContaining('id=123456789'));
    });

    it('should extract tweet from www.x.com URL', () => {
      const result = extractSocialEmbeds('https://www.x.com/user/status/123456789', false);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('embedUrl', expect.stringContaining('id=123456789'));
    });

    it('should extract tweet from mobile.twitter.com URL', () => {
      const result = extractSocialEmbeds('https://mobile.twitter.com/user/status/123456789', false);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('embedUrl', expect.stringContaining('id=123456789'));
    });

    it('should extract multiple tweets and deduplicate', () => {
      const text = 'https://x.com/a/status/111 and https://x.com/b/status/222 and https://x.com/a/status/111';
      const result = extractSocialEmbeds(text, false);
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('embedUrl', expect.stringContaining('id=111'));
      expect(result[1]).toHaveProperty('embedUrl', expect.stringContaining('id=222'));
    });

    it('should append theme=dark when isDarkMode is true', () => {
      const result = extractSocialEmbeds('https://x.com/user/status/123', true);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('embedUrl', 'https://platform.twitter.com/embed/Tweet.html?id=123&theme=dark');
    });

    it('should not append theme when isDarkMode is false', () => {
      const result = extractSocialEmbeds('https://x.com/user/status/123', false);
      expect(result[0]).toHaveProperty('embedUrl', expect.not.stringContaining('theme=dark'));
    });

    it('should extract tweet ID ignoring query params after the URL', () => {
      const result = extractSocialEmbeds('https://x.com/user/status/123?s=20&t=abc', false);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('embedUrl', expect.stringContaining('id=123'));
    });
  });

  describe('X/Twitter extraction — security rejections', () => {
    it('should reject HTTP tweet URLs', () => {
      const result = extractSocialEmbeds('http://x.com/user/status/123', false);
      expect(result).toHaveLength(0);
    });

    it('should reject non-numeric tweet IDs', () => {
      const result = extractSocialEmbeds('https://x.com/user/status/abc', false);
      expect(result).toHaveLength(0);
    });

    it('should reject wrong domain (evil-x.com)', () => {
      const result = extractSocialEmbeds('https://evil-x.com/user/status/123', false);
      expect(result).toHaveLength(0);
    });

    it('should reject subdomain attack (x.com.evil.com)', () => {
      const result = extractSocialEmbeds('https://x.com.evil.com/user/status/123', false);
      expect(result).toHaveLength(0);
    });

    it('should return empty array for empty string', () => {
      expect(extractSocialEmbeds('', false)).toEqual([]);
    });

    it('should return empty array for plain text', () => {
      expect(extractSocialEmbeds('Hello world, no URLs here!', false)).toEqual([]);
    });

    it('should reject non-status Twitter URLs', () => {
      expect(extractSocialEmbeds('https://x.com/user', false)).toEqual([]);
      expect(extractSocialEmbeds('https://x.com/user/likes', false)).toEqual([]);
    });
  });

  describe('Facebook extraction — valid URLs', () => {
    it('should extract facebook.com/user/posts/ID URL', () => {
      const result = extractSocialEmbeds('https://www.facebook.com/user/posts/123456', false);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        platform: 'facebook',
        embedUrl: `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent('https://www.facebook.com/user/posts/123456')}&width=350`,
        originalUrl: 'https://www.facebook.com/user/posts/123456',
      });
    });

    it('should extract facebook.com/photo/?fbid=ID URL', () => {
      const result = extractSocialEmbeds('https://www.facebook.com/photo/?fbid=123456', false);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ platform: 'facebook' });
    });

    it('should extract facebook.com/reel/ID URL', () => {
      const result = extractSocialEmbeds('https://www.facebook.com/reel/123456', false);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ platform: 'facebook' });
    });

    it('should extract facebook.com/watch/?v=ID URL', () => {
      const result = extractSocialEmbeds('https://www.facebook.com/watch/?v=123456', false);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ platform: 'facebook' });
    });

    it('should extract fb.watch short URL', () => {
      const result = extractSocialEmbeds('https://fb.watch/abc123/', false);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ platform: 'facebook', originalUrl: 'https://fb.watch/abc123/' });
    });

    it('should extract multiple Facebook URLs and deduplicate', () => {
      const text = 'https://www.facebook.com/user/posts/111 and https://www.facebook.com/reel/222 and https://www.facebook.com/user/posts/111';
      const result = extractSocialEmbeds(text, false);
      expect(result).toHaveLength(2);
    });

    it('should URL-encode the Facebook URL in the embed URL', () => {
      const url = 'https://www.facebook.com/user/posts/123456';
      const result = extractSocialEmbeds(url, false);
      expect(result[0]).toHaveProperty('embedUrl', expect.stringContaining(encodeURIComponent(url)));
    });
  });

  describe('Facebook extraction — security rejections', () => {
    it('should reject HTTP Facebook URLs', () => {
      const result = extractSocialEmbeds('http://www.facebook.com/user/posts/123', false);
      expect(result).toHaveLength(0);
    });

    it('should reject subdomain attack (facebook.com.evil.com)', () => {
      const result = extractSocialEmbeds('https://facebook.com.evil.com/user/posts/123', false);
      expect(result).toHaveLength(0);
    });

    it('should reject facebook.com root URL (no post path)', () => {
      const result = extractSocialEmbeds('https://www.facebook.com/', false);
      expect(result).toHaveLength(0);
    });

    it('should return empty array for empty string', () => {
      expect(extractSocialEmbeds('', false)).toEqual([]);
    });

    it('should return empty array for plain text', () => {
      expect(extractSocialEmbeds('Just chatting about facebook today', false)).toEqual([]);
    });
  });

  describe('mixed content', () => {
    it('should extract both X and Facebook URLs from the same text', () => {
      const text = 'Check https://x.com/user/status/111 and https://www.facebook.com/user/posts/222';
      const result = extractSocialEmbeds(text, false);
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ platform: 'x' });
      expect(result[1]).toMatchObject({ platform: 'facebook' });
    });

    it('should not extract non-social URLs', () => {
      const text = 'https://example.com and https://youtube.com/watch?v=abc';
      const result = extractSocialEmbeds(text, false);
      expect(result).toHaveLength(0);
    });
  });
});
