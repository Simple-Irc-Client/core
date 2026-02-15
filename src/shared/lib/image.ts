import { isSafeUrl, isPrivateHost } from './utils';

const IMAGE_REGEX = /https:\/\/[^\s?#]+\.(?:jpg|jpeg|gif|png)(?=[?#\s]|$)(?:\?[^\s]*)?/gi;

export const extractImageUrls = (text: string): string[] => {
  const urls: string[] = [];
  for (const match of text.matchAll(IMAGE_REGEX)) {
    if (match[0] && !urls.includes(match[0]) && isSafeImageUrl(match[0])) {
      urls.push(match[0]);
    }
  }
  return urls;
};

function isSafeImageUrl(url: string): boolean {
  if (!isSafeUrl(url)) return false;
  try {
    const { hostname } = new URL(url);
    return !isPrivateHost(hostname);
  } catch {
    return false;
  }
}
