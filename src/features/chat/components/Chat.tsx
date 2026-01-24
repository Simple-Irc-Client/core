import { useCallback, useEffect, useRef } from 'react';
import { useSettingsStore, type FontSize } from '@features/settings/store/settings';
import { MessageCategory, type Message } from '@shared/types';

const fontSizeClasses: Record<FontSize, string> = {
  small: 'text-xs',
  medium: 'text-sm',
  large: 'text-base',
};
import { format } from 'date-fns';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { useCurrentStore } from '@features/chat/store/current';
import Avatar from '@shared/components/Avatar';
import ImagesPreview from '@shared/components/ImagesPreview';
import YouTubeThumbnail from '@shared/components/YouTubeThumbnail';
import MessageText from './MessageText';
import { useContextMenu } from '@/providers/ContextMenuContext';

const ChatViewDebug = ({ message, fontSizeClass }: { message: Message; fontSizeClass: string }) => {
  const { handleContextMenuUserClick } = useContextMenu();
  const nick = message?.nick !== undefined ? (typeof message.nick === 'string' ? message.nick : message.nick.nick) : undefined;

  const handleNickContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    if (nick) {
      event.preventDefault();
      handleContextMenuUserClick(event, 'user', nick);
    }
  };

  return (
    <div className="py-1 px-4 overflow-hidden">
      <code className={`${fontSizeClass} break-all`}>
        <span style={{ color: MessageColor.time }}>{format(new Date(message.time), 'HH:mm:ss')}</span>
        &nbsp;
        {nick !== undefined && (
          <span className="cursor-pointer hover:underline" onContextMenu={handleNickContextMenu}>
            &lt;{nick}&gt;
          </span>
        )}
        &nbsp;
        <MessageText text={message.message} color={message.color ?? MessageColor.default} />
      </code>
    </div>
  );
};

const ChatViewClassic = ({ message, fontSizeClass }: { message: Message; fontSizeClass: string }) => {
  const { handleContextMenuUserClick } = useContextMenu();
  const nick = message?.nick !== undefined ? (typeof message.nick === 'string' ? message.nick : message.nick.nick) : undefined;

  const handleNickContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    if (nick) {
      event.preventDefault();
      handleContextMenuUserClick(event, 'user', nick);
    }
  };

  return (
    <div className="py-1 px-4">
      <div className={fontSizeClass}>
        <span style={{ color: MessageColor.time }}>{format(new Date(message.time), 'HH:mm')}</span>
        &nbsp;
        {nick !== undefined ? (
          <span className="cursor-pointer hover:underline" onContextMenu={handleNickContextMenu}>
            &lt;{nick}&gt;
          </span>
        ) : (
          ''
        )}
        &nbsp;
        <MessageText text={message.message} color={message.color ?? MessageColor.default} />
      </div>
      <YouTubeThumbnail text={message.message} />
      <ImagesPreview text={message.message} />
    </div>
  );
};

const ChatViewModern = ({ message, lastNick, fontSizeClass }: { message: Message; lastNick: string; fontSizeClass: string }) => {
  const { handleContextMenuUserClick } = useContextMenu();
  const nick = message.nick !== undefined ? (typeof message.nick === 'string' ? message.nick : message.nick.nick) : '';
  const avatar = message?.nick !== undefined ? (typeof message.nick === 'string' ? undefined : message.nick.avatar) : undefined;
  const avatarLetter = message?.nick !== undefined ? (typeof message.nick === 'string' ? message.nick.substring(0, 1) : message.nick.nick.substring(0, 1)) : '';
  const nickColor = message?.nick !== undefined ? (typeof message.nick === 'string' ? 'inherit' : message.nick.color) : 'inherit';

  const handleNickContextMenu = (event: React.MouseEvent<HTMLElement>) => {
    if (nick) {
      event.preventDefault();
      handleContextMenuUserClick(event, 'user', nick);
    }
  };

  // TODO fix notice message layout - currently there is no nick displayed

  return (
    <>
      {message.category !== MessageCategory.default && (
        <div className="py-1 px-4 pl-16" style={{ color: message.color ?? MessageColor.default }}>
          <div className={fontSizeClass}>
            <MessageText text={message.message} />
          </div>
        </div>
      )}
      {message.category === MessageCategory.default && (
        <div className={`flex items-start px-4 ${lastNick === nick ? 'py-0' : 'py-2'}`}>
          <div className="w-10 mr-3 flex-shrink-0">
            {lastNick !== nick && (
              <Avatar
                src={avatar}
                alt={nick}
                fallbackLetter={avatarLetter}
                className="h-10 w-10 cursor-pointer"
                onContextMenu={handleNickContextMenu}
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            {lastNick !== nick && (
              <div className="flex items-baseline mb-1">
                <span className={`font-medium ${fontSizeClass} cursor-pointer hover:underline`} style={{ color: nickColor }} onContextMenu={handleNickContextMenu}>
                  {nick}
                </span>
                <div className="flex-1" />
                <span className="text-xs min-w-fit ml-2" style={{ color: MessageColor.time }}>
                  {format(new Date(message.time), 'HH:mm')}
                </span>
              </div>
            )}
            <div style={{ color: message.color ?? MessageColor.default }}>
              {lastNick !== nick && (
                <div className={fontSizeClass}>
                  <MessageText text={message.message} />
                </div>
              )}
              {lastNick === nick && (
                <div className="flex items-baseline">
                  <div className={`${fontSizeClass} flex-1`}>
                    <MessageText text={message.message} />
                  </div>
                  <span className="text-xs min-w-fit ml-2" style={{ color: MessageColor.time }}>
                    {format(new Date(message.time), 'HH:mm')}
                  </span>
                </div>
              )}
            </div>
            <YouTubeThumbnail text={message.message} />
            <ImagesPreview text={message.message} />
          </div>
        </div>
      )}
    </>
  );
};

const getNickFromMessage = (message: Message | undefined): string => {
  if (!message?.nick) return '';
  return typeof message.nick === 'string' ? message.nick : message.nick.nick;
};

const Chat = () => {
  const currentChannelName: string = useSettingsStore((state) => state.currentChannelName);
  const theme: string = useSettingsStore((state) => state.theme);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const messages = useCurrentStore((state) => state.messages);
  const fontSizeClass = fontSizeClasses[fontSize];

  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      isUserScrolledUp.current = distanceFromBottom > 50;
    }
  }, []);

  useEffect(() => {
    isUserScrolledUp.current = false;
  }, [currentChannelName]);

  useEffect(() => {
    if (containerRef.current && !isUserScrolledUp.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const content = container.firstElementChild;
    if (!content) return;

    const resizeObserver = new ResizeObserver(() => {
      if (!isUserScrolledUp.current) {
        container.scrollTop = container.scrollHeight;
      }
    });

    resizeObserver.observe(content);

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div ref={containerRef} onScroll={handleScroll} className="h-full overflow-y-auto overflow-x-hidden relative break-all">
      <div className="pt-0 pb-0">
        {messages.map((message, index) => {
          const lastNick = getNickFromMessage(messages[index - 1]);
          return (
            <div key={`message-${message.id}`}>
              {[DEBUG_CHANNEL, STATUS_CHANNEL].includes(currentChannelName) && <ChatViewDebug message={message} fontSizeClass={fontSizeClass} />}
              {![DEBUG_CHANNEL, STATUS_CHANNEL].includes(currentChannelName) && (
                <>
                  {theme === 'classic' && <ChatViewClassic message={message} fontSizeClass={fontSizeClass} />}
                  {theme === 'modern' && <ChatViewModern message={message} lastNick={lastNick} fontSizeClass={fontSizeClass} />}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Chat;
