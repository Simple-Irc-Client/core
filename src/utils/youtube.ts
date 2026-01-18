const YOUTUBE_PATTERNS = [
  /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  /youtu\.be\/([a-zA-Z0-9_-]{11})/,
];

export const extractYouTubeVideoId = (text: string): string | null => {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
};

export const getYouTubeThumbnailUrl = (videoId: string): string => {
  return `https://img.youtube.com/vi/${videoId}/default.jpg`;
};
