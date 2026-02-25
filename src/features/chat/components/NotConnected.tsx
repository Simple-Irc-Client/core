import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { WifiOff } from 'lucide-react';

const NotConnected = () => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const [arrow, setArrow] = useState<{
    svgStyle: React.CSSProperties;
    width: number;
    height: number;
    path: string;
    arrowHead: string;
  } | null>(null);

  const updateArrow = useCallback(() => {
    const container = containerRef.current;
    const description = descriptionRef.current;
    if (!container || !description) return;

    const avatarButton = document.querySelector<HTMLElement>(
      '[data-avatar-button]',
    );
    if (!avatarButton) return;

    const containerRect = container.getBoundingClientRect();
    const descRect = description.getBoundingClientRect();
    const avatarRect = avatarButton.getBoundingClientRect();

    // Start: below the description text, center-horizontally
    const startX = descRect.left + descRect.width / 2 - containerRect.left;
    const startY = descRect.bottom + 16 - containerRect.top;

    // End: bottom edge of container, horizontally aligned with the avatar
    const endX = avatarRect.left + avatarRect.width / 2 - containerRect.left;
    const endY = containerRect.height - 24;

    // SVG bounds with padding
    const padding = 20;
    const minX = Math.min(startX, endX) - padding;
    const minY = Math.min(startY, endY) - padding;
    const maxX = Math.max(startX, endX) + padding;
    const maxY = Math.max(startY, endY) + padding;
    const width = maxX - minX;
    const height = maxY - minY;

    // Coordinates relative to the SVG viewBox
    const sx = startX - minX;
    const sy = startY - minY;
    const ex = endX - minX;
    const ey = endY - minY;

    // Curve ends partway down, then a straight vertical line to the tip
    const straightLen = Math.max(20, (ey - sy) * 0.12);
    const curveEndY = ey - straightLen;

    // Control points: cp1 pulls the curve down-right, cp2 brings it in vertically
    const midX = (sx + ex) / 2;
    const cp1x = midX + (sx - ex) * 0.2;
    const cp1y = curveEndY * 0.6;
    const cp2x = ex;
    const cp2y = curveEndY - 60;

    const path = `M${sx} ${sy} C${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${ex} ${curveEndY} L${ex} ${ey}`;

    // Arrowhead points straight down
    const arrowSize = 10;
    const ax1 = ex - arrowSize * 0.5;
    const ay1 = ey - arrowSize;
    const ax2 = ex + arrowSize * 0.5;
    const ay2 = ey - arrowSize;

    const arrowHead = `M${ex} ${ey} L${ax1} ${ay1} M${ex} ${ey} L${ax2} ${ay2}`;

    setArrow({
      svgStyle: { left: minX, top: minY },
      width,
      height,
      path,
      arrowHead,
    });
  }, []);

  useEffect(() => {
    updateArrow();

    window.addEventListener('resize', updateArrow);
    return () => window.removeEventListener('resize', updateArrow);
  }, [updateArrow]);

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center h-full text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="h-12 w-12 mb-4 opacity-50" aria-hidden="true" />
      <p className="text-lg font-medium">{t('main.chat.notConnected')}</p>
      <p ref={descriptionRef} className="text-sm mt-1">
        {t('main.chat.notConnectedDescription')}
      </p>
      {arrow && (
        <svg
          className="absolute z-10 pointer-events-none opacity-40"
          style={arrow.svgStyle}
          width={arrow.width}
          height={arrow.height}
          fill="none"
          aria-hidden="true"
        >
          <path
            d={arrow.path}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="6 4"
          />
          <path
            d={arrow.arrowHead}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
};

export default NotConnected;
