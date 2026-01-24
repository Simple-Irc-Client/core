import { useState } from 'react';

interface AvatarProps {
  src?: string;
  alt: string;
  fallbackLetter: string;
  className?: string;
  onContextMenu?: (event: React.MouseEvent<HTMLElement>) => void;
}

const Avatar = ({ src, alt, fallbackLetter, className = '', onContextMenu }: AvatarProps) => {
  const [hasError, setHasError] = useState(false);

  const showFallback = !src || hasError;

  return (
    <div className={`relative flex shrink-0 overflow-hidden rounded-full ${className}`} onContextMenu={onContextMenu}>
      {showFallback ? (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
          {fallbackLetter}
        </span>
      ) : (
        <img
          className="aspect-square h-full w-full"
          alt={alt}
          src={src}
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
};

export default Avatar;
