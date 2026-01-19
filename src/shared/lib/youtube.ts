const YOUTUBE_REGEX =
  /(?:youtube\.com\/watch\?[^\s]*v=|youtube\.com\/v\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;

export const extractYouTubeVideoIds = (text: string): string[] => {
  const ids: string[] = [];
  for (const match of text.matchAll(YOUTUBE_REGEX)) {
    if (match[1] && !ids.includes(match[1])) {
      ids.push(match[1]);
    }
  }
  return ids;
};

export const extractYouTubeVideoId = (text: string): string | null => {
  const ids = extractYouTubeVideoIds(text);
  return ids[0] ?? null;
};

export const getYouTubeThumbnailUrl = (videoId: string): string => {
  return `https://img.youtube.com/vi/${videoId}/default.jpg`;
};
