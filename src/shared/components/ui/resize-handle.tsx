import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@shared/lib/utils';

const KEYBOARD_RESIZE_STEP = 10;

interface ResizeHandleProps {
  onResize: (delta: number) => void;
  direction?: 'left' | 'right';
  className?: string;
  'aria-label'?: string;
}

const ResizeHandle = ({ onResize, direction = 'right', className, 'aria-label': ariaLabel }: ResizeHandleProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const multiplier = direction === 'right' ? 1 : -1;
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        onResize(KEYBOARD_RESIZE_STEP * multiplier);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        onResize(-KEYBOARD_RESIZE_STEP * multiplier);
        break;
    }
  }, [onResize, direction]);

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
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      tabIndex={0}
      className={cn(
        'w-1 cursor-col-resize hover:bg-blue-500/50 active:bg-blue-500/70 transition-colors flex-shrink-0 focus:outline-none focus:bg-blue-500/50',
        isDragging && 'bg-blue-500/70',
        className,
      )}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
    />
  );
};

export { ResizeHandle };
