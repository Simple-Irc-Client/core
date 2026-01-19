import { extractYouTubeVideoIds, getYouTubeThumbnailUrl } from '@shared/lib/youtube';

interface YouTubeThumbnailProps {
  text: string;
}

const YouTubeThumbnail = ({ text }: YouTubeThumbnailProps) => {
  const videoIds = extractYouTubeVideoIds(text);

  if (videoIds.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {videoIds.map((videoId) => (
        <a
          key={videoId}
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src={getYouTubeThumbnailUrl(videoId)}
            alt="YouTube video thumbnail"
            className="rounded max-w-30 hover:opacity-80 transition-opacity"
          />
        </a>
      ))}
    </div>
  );
};

export default YouTubeThumbnail;
