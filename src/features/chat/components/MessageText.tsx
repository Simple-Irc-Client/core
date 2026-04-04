import { useMemo } from 'react';
import { useContextMenu } from '@/providers/ContextMenuContext';
import { getChannelTypes } from '@features/settings/store/settings';
import {
  parseIrcFormatting,
  hasIrcFormatting,
  stripIrcFormatting,
  renderFormattedSegments,
} from '@/shared/lib/ircFormatting';
import type { FormattedSegment } from '@/shared/lib/ircFormatting';
import { isSafeUrl } from '@shared/lib/utils';

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
  const { handleContextMenuUserClick } = useContextMenu();

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

          if (part.segments) {
            return <span key={key}>{renderFormattedSegments(part.segments, color)}</span>;
          }

          return <span key={key}>{part.value}</span>;
        });
      })()}
    </span>
  );
};

export default MessageText;
