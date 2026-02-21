import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import SocialEmbed from '../SocialEmbed';
import * as socialEmbed from '@shared/lib/socialEmbed';
import type { SocialEmbedInfo } from '@shared/lib/socialEmbed';

describe('SocialEmbed', () => {
  describe('when no social URLs are found', () => {
    it('should return null for plain text', () => {
      vi.spyOn(socialEmbed, 'extractSocialEmbeds').mockReturnValue([]);

      const { container } = render(<SocialEmbed text="Hello world" />);
      expect(container.innerHTML).toBe('');
    });

    it('should return null for empty text', () => {
      vi.spyOn(socialEmbed, 'extractSocialEmbeds').mockReturnValue([]);

      const { container } = render(<SocialEmbed text="" />);
      expect(container.innerHTML).toBe('');
    });
  });

  describe('when social URLs are found', () => {
    const twitterEmbed: SocialEmbedInfo = {
      platform: 'x',
      embedUrl: 'https://platform.twitter.com/embed/Tweet.html?id=123',
      originalUrl: 'https://x.com/user/status/123',
    };

    const facebookEmbed: SocialEmbedInfo = {
      platform: 'facebook',
      embedUrl: 'https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Fuser%2Fposts%2F456&width=350',
      originalUrl: 'https://www.facebook.com/user/posts/456',
    };

    it('should render an iframe for a Twitter/X URL', () => {
      vi.spyOn(socialEmbed, 'extractSocialEmbeds').mockReturnValue([twitterEmbed]);

      render(<SocialEmbed text="https://x.com/user/status/123" />);

      const iframe = document.querySelector('iframe');
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute('src', twitterEmbed.embedUrl);
    });

    it('should render an iframe for a Facebook URL', () => {
      vi.spyOn(socialEmbed, 'extractSocialEmbeds').mockReturnValue([facebookEmbed]);

      render(<SocialEmbed text="https://www.facebook.com/user/posts/456" />);

      const iframe = document.querySelector('iframe');
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute('src', facebookEmbed.embedUrl);
    });

    it('should render multiple iframes for multiple social URLs', () => {
      vi.spyOn(socialEmbed, 'extractSocialEmbeds').mockReturnValue([twitterEmbed, facebookEmbed]);

      render(<SocialEmbed text="mixed content" />);

      const iframes = document.querySelectorAll('iframe');
      expect(iframes).toHaveLength(2);
    });

    it('should have sandbox attribute without allow-top-navigation', () => {
      vi.spyOn(socialEmbed, 'extractSocialEmbeds').mockReturnValue([twitterEmbed]);

      render(<SocialEmbed text="tweet" />);

      const iframe = document.querySelector('iframe');
      expect(iframe).toHaveAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups');
      const sandbox = iframe?.getAttribute('sandbox') ?? '';
      expect(sandbox).not.toContain('allow-top-navigation');
    });

    it('should have referrerPolicy set to no-referrer', () => {
      vi.spyOn(socialEmbed, 'extractSocialEmbeds').mockReturnValue([twitterEmbed]);

      render(<SocialEmbed text="tweet" />);

      const iframe = document.querySelector('iframe');
      expect(iframe).toHaveAttribute('referrerPolicy', 'no-referrer');
    });

    it('should have loading=lazy for performance', () => {
      vi.spyOn(socialEmbed, 'extractSocialEmbeds').mockReturnValue([twitterEmbed]);

      render(<SocialEmbed text="tweet" />);

      const iframe = document.querySelector('iframe');
      expect(iframe).toHaveAttribute('loading', 'lazy');
    });

    it('should have an accessible title', () => {
      vi.spyOn(socialEmbed, 'extractSocialEmbeds').mockReturnValue([twitterEmbed]);

      render(<SocialEmbed text="tweet" />);

      const iframe = document.querySelector('iframe');
      expect(iframe).toHaveAttribute('title');
      const title = iframe?.getAttribute('title') ?? '';
      expect(title).not.toBe('');
    });
  });
});
