import { useTranslation } from 'react-i18next';
import { extractYouTubeVideoIds, getYouTubeThumbnailUrl } from '@shared/lib/youtube';

interface YouTubeThumbnailProps {
  text: string;
}

const YouTubeThumbnail = ({ text }: YouTubeThumbnailProps) => {
  const { t } = useTranslation();
  const videoIds = extractYouTubeVideoIds(text);

  if (videoIds.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {videoIds.map((videoId) => {
        const thumbnailUrl = getYouTubeThumbnailUrl(videoId);
        if (!thumbnailUrl) return null;
        return (
          <a
            key={videoId}
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('a11y.watchYouTube')}
          >
            <img
              src={thumbnailUrl}
              alt="YouTube video thumbnail"
              className="rounded max-w-30 hover:opacity-80 transition-opacity"
            />
          </a>
        );
      })}
    </div>
  );
};

export default YouTubeThumbnail;
