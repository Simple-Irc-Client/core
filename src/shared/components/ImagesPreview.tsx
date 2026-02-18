import { useTranslation } from 'react-i18next';
import { extractImageUrls } from '@shared/lib/image';

interface ImagesPreviewProps {
  text: string;
}

const ImagesPreview = ({ text }: ImagesPreviewProps) => {
  const { t } = useTranslation();
  const imageUrls = extractImageUrls(text);

  if (imageUrls.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {imageUrls.map((url) => (
        <a key={url} href={url} target="_blank" rel="noopener noreferrer" aria-label={t('a11y.openImage')}>
          <img
            src={url}
            alt="Image thumbnail"
            className="rounded max-w-30 max-h-30 hover:opacity-80 transition-opacity"
          />
        </a>
      ))}
    </div>
  );
};

export default ImagesPreview;
