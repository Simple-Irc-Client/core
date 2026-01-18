import { extractImageUrls } from '@/utils/image';

interface ImagesPreviewProps {
  text: string;
}

const ImagesPreview = ({ text }: ImagesPreviewProps) => {
  const imageUrls = extractImageUrls(text);

  if (imageUrls.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {imageUrls.map((url) => (
        <a key={url} href={url} target="_blank" rel="noopener noreferrer">
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
