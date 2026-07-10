import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useSettingsStore, type FontSize } from '@features/settings/store/settings';

const fontSizeClasses: Record<FontSize, string> = {
  small: 'text-xs',
  medium: 'text-sm',
  large: 'text-base',
};
import { startOfDay } from 'date-fns';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { useCurrentStore } from '@features/chat/store/current';
import DateSeparator from './DateSeparator';
import { useContextMenu } from '@/providers/ContextMenuContext';
import NotConnected from './NotConnected';
import DisconnectedBanner from './DisconnectedBanner';
import { getNickFromMessage } from '@shared/lib/displayName';
import ChatMessage, { contentCategories } from './ChatMessage';

const Chat = () => {
  const { handleContextMenuUserClick } = useContextMenu();
  const currentChannelName: string = useSettingsStore((state) => state.currentChannelName);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const isConnected = useSettingsStore((state) => state.isConnected);
  const messages = useCurrentStore((state) => state.messages);
  const fontSizeClass = fontSizeClasses[fontSize];

  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);
  const isProgrammaticScroll = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const newScrollTop = scrollHeight - clientHeight;
      if (newScrollTop > 0 && Math.abs(scrollTop - newScrollTop) > 1) {
        isProgrammaticScroll.current = true;
      }
      containerRef.current.scrollTop = scrollHeight;
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (isProgrammaticScroll.current) {
      isProgrammaticScroll.current = false;
      return;
    }
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      isUserScrolledUp.current = distanceFromBottom > 50;
    }
  }, []);

  useLayoutEffect(() => {
    isUserScrolledUp.current = false;
    scrollToBottom();
  }, [currentChannelName, scrollToBottom]);

  useLayoutEffect(() => {
    if (!isUserScrolledUp.current) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) { return; }

    const content = container.lastElementChild;
    if (!content) { return; }

    const resizeObserver = new ResizeObserver(() => {
      if (!isUserScrolledUp.current) {
        scrollToBottom();
      }
    });

    resizeObserver.observe(content);

    return () => resizeObserver.disconnect();
  }, [isConnected, scrollToBottom]);

  return (
    <div ref={containerRef} data-testid="chat-log" role="log" onScroll={handleScroll} onContextMenu={(e) => {
      if (e.defaultPrevented) { return; }
      e.preventDefault();
      e.stopPropagation();
      const selection = globalThis.getSelection()?.toString();
      if (selection) {
        handleContextMenuUserClick(e, 'text', selection);
      } else {
        handleContextMenuUserClick(e, 'chat', currentChannelName);
      }
    }} className="h-full overflow-y-auto overflow-x-hidden relative break-all">
      {!isConnected && <DisconnectedBanner />}
      {!isConnected && messages.length === 0 && <NotConnected />}
      <div className="pt-0 pb-0">
        {messages.map((message, index) => {
          const currentDate = startOfDay(new Date(message.time));
          const prevMessage = messages[index - 1];
          const prevDate = prevMessage ? startOfDay(new Date(prevMessage.time)) : null;
          const showDateSeparator = prevDate !== null && currentDate.getTime() !== prevDate.getTime();
          const lastNick = showDateSeparator ? '' : (prevMessage && contentCategories.has(prevMessage.category) ? (getNickFromMessage(prevMessage) ?? '') : '');
          const isDebug = [DEBUG_CHANNEL, STATUS_CHANNEL].includes(currentChannelName);
          const grouped = !isDebug && contentCategories.has(message.category) && lastNick === (getNickFromMessage(message) ?? '');
          return (
            <div key={`message-${message.id}`}>
              {showDateSeparator && <DateSeparator date={currentDate} />}
              <ChatMessage message={message} grouped={grouped} isDebug={isDebug} fontSizeClass={fontSizeClass} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Chat;
