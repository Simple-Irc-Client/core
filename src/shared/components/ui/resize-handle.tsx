import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@shared/lib/utils';

interface ResizeHandleProps {
  onResize: (delta: number) => void;
  direction?: 'left' | 'right';
  className?: string;
}

const ResizeHandle = ({ onResize, direction = 'right', className }: ResizeHandleProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      startXRef.current = e.clientX;
      onResize(direction === 'right' ? delta : -delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onResize, direction]);

  return (
    <div
      className={cn(
        'w-1 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500/70 transition-colors flex-shrink-0',
        isDragging && 'bg-blue-500/70',
        className,
      )}
      onMouseDown={handleMouseDown}
    />
  );
};

export { ResizeHandle };
