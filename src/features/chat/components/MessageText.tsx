import { useMemo, type CSSProperties } from 'react';
import { useContextMenu } from '@/providers/ContextMenuContext';
import { getChannelTypes } from '@features/settings/store/settings';
import {
  parseIrcFormatting,
  hasIrcFormatting,
} from '@/shared/lib/ircFormatting';
import type { FormattedSegment, FormatState } from '@/shared/lib/ircFormatting';

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

  if (fg) {
    style.color = fg;
  } else if (baseColor) {
    style.color = baseColor;
  }

  if (bg) {
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
    const result: TextPart[] = [];

    // Build regex pattern for channel names (e.g., #channel, &channel)
    // Channel names start with channel type prefix and continue until space or end
    const channelTypesEscaped = channelTypes.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
    const channelPattern = channelTypesEscaped.length > 0 ? `[${channelTypesEscaped}][^\\s,]+` : null;

    // Split text by words to check for channels
    const words = text.split(/(\s+)/);

    for (const word of words) {
      // Check if it's whitespace
      if (/^\s+$/.test(word)) {
        result.push({ type: 'text', value: word });
        continue;
      }

      // Check if it's a channel name
      if (channelPattern) {
        const channelRegex = new RegExp(`^(${channelPattern})$`);
        if (channelRegex.test(word)) {
          result.push({ type: 'channel', value: word });
          continue;
        }
      }

      // Regular text - parse IRC formatting if present
      if (hasIrcFormatting(word)) {
        result.push({
          type: 'text',
          value: word,
          segments: parseIrcFormatting(word),
        });
      } else {
        result.push({ type: 'text', value: word });
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
