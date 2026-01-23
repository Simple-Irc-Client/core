import { useCallback, useEffect, useRef } from 'react';
import { useSettingsStore } from '@features/settings/store/settings';
import { MessageCategory, type Message } from '@shared/types';
import { format } from 'date-fns';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { useCurrentStore } from '@features/chat/store/current';
import ImagesPreview from '@shared/components/ImagesPreview';
import YouTubeThumbnail from '@shared/components/YouTubeThumbnail';
import MessageText from './MessageText';
import { useContextMenu } from '@/providers/ContextMenuContext';

const ChatViewDebug = ({ message }: { message: Message }) => {
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
      <code className="text-sm break-all">
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

const ChatViewClassic = ({ message }: { message: Message }) => {
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
      <div className="text-sm">
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

const ChatViewModern = ({ message, lastNick }: { message: Message; lastNick: string }) => {
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
          <div className="text-sm">
            <MessageText text={message.message} />
          </div>
        </div>
      )}
      {message.category === MessageCategory.default && (
        <div className={`flex items-start px-4 ${lastNick === nick ? 'py-0' : 'py-2'}`}>
          <div className="w-10 mr-3 flex-shrink-0">
            {lastNick !== nick && (
              <div className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full cursor-pointer" onContextMenu={handleNickContextMenu}>
                {avatar ? (
                  <img className="aspect-square h-full w-full" alt={nick} src={avatar} />
                ) : (
                  <span className="flex h-full w-full items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                    {avatarLetter}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {lastNick !== nick && (
              <div className="flex items-baseline mb-1">
                <span className="font-medium text-sm cursor-pointer hover:underline" style={{ color: nickColor }} onContextMenu={handleNickContextMenu}>
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
                <div className="text-sm">
                  <MessageText text={message.message} />
                </div>
              )}
              {lastNick === nick && (
                <div className="flex items-baseline">
                  <div className="text-sm flex-1">
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
  const messages = useCurrentStore((state) => state.messages);

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

  return (
    <div ref={containerRef} onScroll={handleScroll} className="h-full overflow-y-auto overflow-x-hidden relative break-all">
      <div className="pt-0 pb-0">
        {messages.map((message, index) => {
          const lastNick = getNickFromMessage(messages[index - 1]);
          return (
            <div key={`message-${message.id}`}>
              {[DEBUG_CHANNEL, STATUS_CHANNEL].includes(currentChannelName) && <ChatViewDebug message={message} />}
              {![DEBUG_CHANNEL, STATUS_CHANNEL].includes(currentChannelName) && (
                <>
                  {theme === 'classic' && <ChatViewClassic message={message} />}
                  {theme === 'modern' && <ChatViewModern message={message} lastNick={lastNick} />}
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
