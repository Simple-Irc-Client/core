import { useMemo } from 'react';
import { useContextMenuActions } from '@/providers/ContextMenuContext';
import { getChannelTypes } from '@features/settings/store/settings';
import {
  parseIrcFormatting,
  hasIrcFormatting,
  stripIrcFormatting,
  renderFormattedSegments,
  getStyleFromFormatState,
} from '@/shared/lib/ircFormatting';
import type { FormattedSegment } from '@/shared/lib/ircFormatting';
import { isSafeUrl } from '@shared/lib/utils';
import { splitEmoji } from '@/shared/lib/emoji';

interface MessageTextProps {
  text: string;
  color?: string;
}

interface TextPart {
  type: 'text' | 'channel' | 'url';
  value: string;
  segments?: FormattedSegment[];
}

const MessageText = ({ text, color }: MessageTextProps) => {
  const { handleContextMenuUserClick } = useContextMenuActions();

  const parts = useMemo((): TextPart[] => {
    const channelTypes = getChannelTypes();

    // Build regex pattern for channel names (e.g., #channel, &channel)
    // Channel names start with channel type prefix and continue until space or end
    const channelTypesEscaped = channelTypes.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)).join('');
    const channelPattern = channelTypesEscaped.length > 0 ? new RegExp(String.raw`^[${channelTypesEscaped}][^\s,]+$`) : null;

    // Parse IRC formatting on the full text first to preserve state across words
    const segments = hasIrcFormatting(text) ? parseIrcFormatting(text) : null;

    const isUrl = (word: string): boolean => /^https?:\/\/\S+/.test(word) && isSafeUrl(word);

    if (!segments) {
      // No formatting — split by words for channel/URL detection
      const result: TextPart[] = [];
      const words = text.split(/(\s+)/);
      for (const word of words) {
        if (channelPattern && !(/^\s+$/.test(word)) && channelPattern.test(word)) {
          result.push({ type: 'channel', value: word });
        } else if (!(/^\s+$/.test(word)) && isUrl(word)) {
          result.push({ type: 'url', value: word });
        } else {
          result.push({ type: 'text', value: word });
        }
      }
      return result;
    }

    // With formatting — split each segment's text by words for channel/URL detection
    const result: TextPart[] = [];
    for (const segment of segments) {
      const words = segment.text.split(/(\s+)/);
      for (const word of words) {
        const stripped = stripIrcFormatting(word);
        if (channelPattern && !(/^\s+$/.test(word)) && channelPattern.test(stripped)) {
          result.push({ type: 'channel', value: word });
        } else if (!(/^\s+$/.test(word)) && isUrl(stripped)) {
          result.push({ type: 'url', value: word, segments: [{ text: word, style: segment.style }] });
        } else {
          result.push({ type: 'text', value: word, segments: [{ text: word, style: segment.style }] });
        }
      }
    }
    return result;
  }, [text]);

  /** Renders a text run with any emoji inside it wrapped for larger display (see .sic-emoji in the builtin themes). */
  const renderWithEmoji = (runText: string, key: string, style?: React.CSSProperties): React.ReactNode => {
    const runs = splitEmoji(runText);
    const hasEmoji = runs.some((run) => run.isEmoji);
    if (!hasEmoji) {
      return style ? <span key={key} style={style}>{runText}</span> : runText;
    }
    return (
      <span key={key} style={style}>
        {runs.map((run, i) =>
          run.isEmoji ? (
            <span key={i} className="sic-emoji">{run.text}</span>
          ) : (
            <span key={i}>{run.text}</span>
          )
        )}
      </span>
    );
  };

  const handleChannelClick = (event: React.MouseEvent<HTMLElement>, channel: string) => {
    event.preventDefault();
    handleContextMenuUserClick(event, 'channel', channel);
  };

  const handleUrlClick = (event: React.MouseEvent<HTMLElement>, url: string) => {
    event.preventDefault();
    handleContextMenuUserClick(event, 'url', url);
  };

  return (
    <span style={{ color }}>
      {(() => {
        let offset = 0;
        return parts.map((part) => {
          const key = `${offset}-${part.value.length}`;
          offset += part.value.length;

          if (part.type === 'channel') {
            return (
              <span
                key={key}
                className="cursor-pointer hover:underline"
                onContextMenu={(e) => handleChannelClick(e, part.value)}
              >
                {part.value}
              </span>
            );
          }

          if (part.type === 'url') {
            const content = part.segments ? renderFormattedSegments(part.segments, color) : part.value;
            return (
              <span
                key={key}
                className="cursor-pointer hover:underline"
                onClick={(e) => handleUrlClick(e, part.value)}
                onContextMenu={(e) => handleUrlClick(e, part.value)}
              >
                {content}
              </span>
            );
          }

          const [firstSegment] = part.segments ?? [];
          if (firstSegment) {
            const style = getStyleFromFormatState(firstSegment.style, color);
            const hasStyle = Object.keys(style).length > 0;
            return <span key={key}>{renderWithEmoji(part.value, key, hasStyle ? style : undefined)}</span>;
          }

          return <span key={key}>{renderWithEmoji(part.value, key)}</span>;
        });
      })()}
    </span>
  );
};

export default MessageText;
