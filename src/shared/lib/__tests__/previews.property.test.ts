import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { extractImageUrls } from '../image';
import { extractYouTubeVideoIds, getYouTubeThumbnailUrl } from '../youtube';
import { extractSocialEmbeds } from '../socialEmbed';

/** Text as someone may write it: words, real-looking links to the services we preview, and anything at all */
const word = fc.string({ unit: 'binary', maxLength: 30 });
const link = fc.oneof(
  fc.webUrl({ withQueryParameters: true, withFragments: true }),
  fc.tuple(fc.constantFrom('https://youtu.be/', 'https://www.youtube.com/watch?v=', 'https://x.com/a/status/', 'https://www.facebook.com/a/posts/', 'https://fb.watch/', 'https://bsky.app/profile/'), word, fc.constantFrom('', '/post/', '.png', '.jpg?x=1')).map((parts) => parts.join('')),
  fc.tuple(fc.constantFrom('javascript:', 'data:image/png;base64,', 'http://', 'https://'), word).map((parts) => parts.join('')),
);
const message = fc.array(fc.oneof(word, link), { maxLength: 6 }).map((parts) => parts.join(' '));

describe('link previews, for anything someone writes', () => {
  it('only preview images over http or https', () => {
    fc.assert(fc.property(message, (text) => {
      for (const url of extractImageUrls(text)) {
        expect(new URL(url).protocol).toMatch(/^https?:$/);
      }
    }));
  });

  it('only take YouTube ids that make a YouTube thumbnail address', () => {
    fc.assert(fc.property(message, (text) => {
      for (const id of extractYouTubeVideoIds(text)) {
        expect(id).toMatch(/^[\w-]{11}$/);
        expect(new URL(getYouTubeThumbnailUrl(id) ?? '').origin).toBe('https://img.youtube.com');
      }
    }));
  });

  it('only embed pages of the services themselves, under their embed paths', () => {
    const embedPaths: Record<string, [string, string]> = {
      x: ['https://platform.twitter.com', '/embed/'],
      facebook: ['https://www.facebook.com', '/plugins/'],
      bluesky: ['https://embed.bsky.app', '/embed/'],
    };
    fc.assert(fc.property(message, fc.boolean(), (text, isDarkMode) => {
      for (const { platform, embedUrl } of extractSocialEmbeds(text, isDarkMode)) {
        const [origin, path] = embedPaths[platform] ?? ['', ''];
        const parsed = new URL(embedUrl);
        expect(parsed.origin).toBe(origin);
        expect(parsed.pathname.startsWith(path)).toBe(true);
      }
    }));
  });
});
