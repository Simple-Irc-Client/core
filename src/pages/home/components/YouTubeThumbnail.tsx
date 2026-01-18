import { extractYouTubeVideoId, getYouTubeThumbnailUrl } from '../../../utils/youtube';

interface YouTubeThumbnailProps {
  text: string;
}

const YouTubeThumbnail = ({ text }: YouTubeThumbnailProps) => {
  const videoId = extractYouTubeVideoId(text);

  if (!videoId) {
    return null;
  }

  const thumbnailUrl = getYouTubeThumbnailUrl(videoId);
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  return (
    <div className="mt-2">
      <a href={videoUrl} target="_blank" rel="noopener noreferrer">
        <img
          src={thumbnailUrl}
          alt="YouTube video thumbnail"
          className="rounded max-w-[120px] hover:opacity-80 transition-opacity"
        />
      </a>
    </div>
  );
};

export default YouTubeThumbnail;
