const IMAGE_REGEX = /https?:\/\/[^\s]+\.(?:jpg|jpeg|gif|png)(?:\?[^\s]*)?/gi;

export const extractImageUrls = (text: string): string[] => {
  const urls: string[] = [];
  for (const match of text.matchAll(IMAGE_REGEX)) {
    if (match[0] && !urls.includes(match[0])) {
      urls.push(match[0]);
    }
  }
  return urls;
};
