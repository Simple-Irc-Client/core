import { useMemo, type CSSProperties } from 'react';
import { useContextMenu } from '@/providers/ContextMenuContext';
import { getChannelTypes } from '@features/settings/store/settings';
import {
  parseIrcFormatting,
  hasIrcFormatting,
  stripIrcFormatting,
} from '@/shared/lib/ircFormatting';
import type { FormattedSegment, FormatState } from '@/shared/lib/ircFormatting';
import { isSafeCssColor } from '@shared/lib/utils';

interface MessageTextProps {
  text: string;
  color?: string;
}

interface TextPart {
  type: 'text' | 'channel';
  value: string;
  segments?: FormattedSegment[];
}

function getStyleFromFormatState(state: FormatState, baseColor?: string): CSSProperties {
  const style: CSSProperties = {};

  if (state.bold) {
    style.fontWeight = 'bold';
  }

  if (state.italic) {
    style.fontStyle = 'italic';
  }

  if (state.underline && state.strikethrough) {
    style.textDecoration = 'underline line-through';
  } else if (state.underline) {
    style.textDecoration = 'underline';
  } else if (state.strikethrough) {
    style.textDecoration = 'line-through';
  }

  if (state.monospace) {
    style.fontFamily = 'monospace';
  }

  // Handle colors with reverse support
  let fg = state.foreground;
  let bg = state.background;

  if (state.reverse) {
    [fg, bg] = [bg, fg];
  }

  if (fg && isSafeCssColor(fg)) {
    style.color = fg;
  } else if (baseColor) {
    style.color = baseColor;
  }

  if (bg && isSafeCssColor(bg)) {
    style.backgroundColor = bg;
  }

  return style;
}

function renderFormattedSegments(
  segments: FormattedSegment[],
  baseColor?: string
): React.ReactNode[] {
  return segments.map((segment, idx) => {
    const style = getStyleFromFormatState(segment.style, baseColor);
    const hasStyle = Object.keys(style).length > 0;

    if (hasStyle) {
      return (
        <span key={idx} style={style}>
          {segment.text}
        </span>
      );
    }
    return <span key={idx}>{segment.text}</span>;
  });
}

const MessageText = ({ text, color }: MessageTextProps) => {
  const { handleContextMenuUserClick } = useContextMenu();

  const parts = useMemo((): TextPart[] => {
    const channelTypes = getChannelTypes();

    // Build regex pattern for channel names (e.g., #channel, &channel)
    // Channel names start with channel type prefix and continue until space or end
    const channelTypesEscaped = channelTypes.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
    const channelPattern = channelTypesEscaped.length > 0 ? new RegExp(`^[${channelTypesEscaped}][^\\s,]+$`) : null;

    // Parse IRC formatting on the full text first to preserve state across words
    const segments = hasIrcFormatting(text) ? parseIrcFormatting(text) : null;

    if (!segments) {
      // No formatting — split by words for channel detection
      const result: TextPart[] = [];
      const words = text.split(/(\s+)/);
      for (const word of words) {
        if (channelPattern && !(/^\s+$/.test(word)) && channelPattern.test(word)) {
          result.push({ type: 'channel', value: word });
        } else {
          result.push({ type: 'text', value: word });
        }
      }
      return result;
    }

    // With formatting — split each segment's text by words for channel detection
    const result: TextPart[] = [];
    for (const segment of segments) {
      const words = segment.text.split(/(\s+)/);
      for (const word of words) {
        if (channelPattern && !(/^\s+$/.test(word)) && channelPattern.test(stripIrcFormatting(word))) {
          result.push({ type: 'channel', value: word });
        } else {
          result.push({ type: 'text', value: word, segments: [{ text: word, style: segment.style }] });
        }
      }
    }
    return result;
  }, [text]);

  const handleChannelClick = (event: React.MouseEvent<HTMLElement>, channel: string) => {
    event.preventDefault();
    handleContextMenuUserClick(event, 'channel', channel);
  };

  return (
    <span style={{ color }}>
      {parts.map((part, index) => {
        if (part.type === 'channel') {
          return (
            <span
              key={index}
              className="cursor-pointer hover:underline"
              onContextMenu={(e) => handleChannelClick(e, part.value)}
            >
              {part.value}
            </span>
          );
        }

        // Render formatted text if segments exist
        if (part.segments) {
          return <span key={index}>{renderFormattedSegments(part.segments, color)}</span>;
        }

        return <span key={index}>{part.value}</span>;
      })}
    </span>
  );
};

export default MessageText;
