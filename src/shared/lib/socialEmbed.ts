import { isSafeUrl } from './utils';

export interface SocialEmbedInfo {
  platform: 'x' | 'facebook' | 'bluesky';
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

// Match https://bsky.app/profile/HANDLE/post/RKEY
// Handle can be a domain (user.bsky.social) or a DID (did:plc:xxx)
// RKEY is an alphanumeric record key
const BLUESKY_REGEX =
  /https:\/\/bsky\.app\/profile\/([a-zA-Z0-9._:%-]+)\/post\/([a-zA-Z0-9_-]+)/g;

const BLUESKY_HANDLE_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9._:%-]*$/;
const BLUESKY_RKEY_REGEX = /^[a-zA-Z0-9_-]+$/;

function extractBlueskyEmbeds(text: string): SocialEmbedInfo[] {
  const results: SocialEmbedInfo[] = [];

  for (const match of text.matchAll(BLUESKY_REGEX)) {
    const handle = match[1];
    const rkey = match[2];
    const originalUrl = match[0];

    if (!handle || !rkey) continue;
    if (!BLUESKY_HANDLE_REGEX.test(handle)) continue;
    if (!BLUESKY_RKEY_REGEX.test(rkey)) continue;
    if (!isSafeUrl(originalUrl)) continue;
    if (results.some((r) => r.originalUrl === originalUrl)) continue;

    results.push({
      platform: 'bluesky',
      embedUrl: `https://embed.bsky.app/embed/${handle}/app.bsky.feed.post/${rkey}`,
      originalUrl,
    });
  }

  return results;
}

export function extractSocialEmbeds(text: string, isDarkMode: boolean): SocialEmbedInfo[] {
  return [...extractTwitterEmbeds(text, isDarkMode), ...extractFacebookEmbeds(text), ...extractBlueskyEmbeds(text)];
}
