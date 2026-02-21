import { isSafeUrl } from './utils';

export interface SocialEmbedInfo {
  platform: 'x' | 'facebook';
  embedUrl: string;
  originalUrl: string;
}

// Match https://x.com/USER/status/ID or https://twitter.com/USER/status/ID
// Optional www. or mobile. prefix
const TWITTER_REGEX =
  /https:\/\/(?:www\.|mobile\.)?(?:x\.com|twitter\.com)\/[a-zA-Z0-9_]+\/status\/(\d+)/g;

// Match various Facebook post URL patterns
const FACEBOOK_REGEX =
  /https:\/\/(?:www\.)?facebook\.com\/(?:[a-zA-Z0-9.]+\/posts\/\d+|photo\/?\?fbid=\d+[^\s]*|permalink\.php\?story_fbid=\d+[^\s]*|watch\/?\?v=\d+[^\s]*|reel\/\d+)/g;

// Match fb.watch short URLs
const FB_WATCH_REGEX = /https:\/\/fb\.watch\/[a-zA-Z0-9_-]+\/?/g;

const NUMERIC_ID_REGEX = /^\d+$/;

function extractTwitterEmbeds(text: string, isDarkMode: boolean): SocialEmbedInfo[] {
  const results: SocialEmbedInfo[] = [];

  for (const match of text.matchAll(TWITTER_REGEX)) {
    const tweetId = match[1];
    const originalUrl = match[0];

    if (!tweetId || !NUMERIC_ID_REGEX.test(tweetId)) continue;
    if (!isSafeUrl(originalUrl)) continue;
    if (results.some((r) => r.originalUrl === originalUrl)) continue;

    const theme = isDarkMode ? '&theme=dark' : '';
    results.push({
      platform: 'x',
      embedUrl: `https://platform.twitter.com/embed/Tweet.html?id=${tweetId}${theme}`,
      originalUrl,
    });
  }

  return results;
}

function extractFacebookEmbeds(text: string): SocialEmbedInfo[] {
  const results: SocialEmbedInfo[] = [];
  const seen = new Set<string>();

  const addFacebookEmbed = (url: string) => {
    if (seen.has(url)) return;
    if (!isSafeUrl(url)) return;

    // Verify the hostname is actually facebook.com or fb.watch
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (host !== 'www.facebook.com' && host !== 'facebook.com' && host !== 'fb.watch') return;
    } catch {
      return;
    }

    seen.add(url);
    results.push({
      platform: 'facebook',
      embedUrl: `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&width=350`,
      originalUrl: url,
    });
  };

  for (const match of text.matchAll(FACEBOOK_REGEX)) {
    addFacebookEmbed(match[0]);
  }

  for (const match of text.matchAll(FB_WATCH_REGEX)) {
    addFacebookEmbed(match[0]);
  }

  return results;
}

export function extractSocialEmbeds(text: string, isDarkMode: boolean): SocialEmbedInfo[] {
  return [...extractTwitterEmbeds(text, isDarkMode), ...extractFacebookEmbeds(text)];
}
