import { useMemo } from 'react';
import { useContextMenu } from '@/providers/ContextMenuContext';
import { getChannelTypes } from '@features/settings/store/settings';

interface MessageTextProps {
  text: string;
  color?: string;
}

interface TextPart {
  type: 'text' | 'channel';
  value: string;
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

      // Regular text
      result.push({ type: 'text', value: word });
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
        return <span key={index}>{part.value}</span>;
      })}
    </span>
  );
};

export default MessageText;
