import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { renderFormattedSegments, type FormattedSegment } from '@/shared/lib/ircFormatting';
import { cssColorToRgb, ensureReadableColor, relativeLuminance } from '@shared/lib/utils';

interface SpoilerProps {
  /** Runs sharing one color for text and background */
  segments: FormattedSegment[];
}

/** The box's own color, shifted until it reads on the box */
const revealedColor = (background: string): string => {
  const rgb = cssColorToRgb(background);
  return rgb === null ? background : ensureReadableColor(background, relativeLuminance(...rgb));
};

const Spoiler = ({ segments }: SpoilerProps) => {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const background = segments[0]?.style.background ?? undefined;
  // The colors go on the box, so a reveal can change them for every run inside
  const runs = segments.map(({ text, style }) => ({ text, style: { ...style, foreground: null, background: null } }));

  if (revealed) {
    return (
      <span className="sic-spoiler" data-revealed="" style={{ backgroundColor: background, color: background && revealedColor(background) }}>
        {renderFormattedSegments(runs)}
      </span>
    );
  }

  const reveal = (event: React.SyntheticEvent) => {
    event.preventDefault();
    setRevealed(true);
  };

  return (
    <span
      className="sic-spoiler"
      role="button"
      tabIndex={0}
      aria-label={t('main.spoiler.reveal')}
      title={t('main.spoiler.reveal')}
      style={{ backgroundColor: background, color: background }}
      onClick={reveal}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          reveal(event);
        }
      }}
    >
      <span aria-hidden="true">{renderFormattedSegments(runs)}</span>
    </span>
  );
};

export default Spoiler;
