import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useSettingsStore, type FontSize } from '@features/settings/store/settings';

const fontSizeClasses: Record<FontSize, string> = {
  small: 'text-xs',
  medium: 'text-sm',
  large: 'text-base',
};
import { startOfDay } from 'date-fns';
import type { Message } from '@shared/types';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { useCurrentStore } from '@features/chat/store/current';
import DateSeparator from './DateSeparator';
import { useContextMenuActions } from '@/providers/ContextMenuContext';
import NotConnected from './NotConnected';
import DisconnectedBanner from './DisconnectedBanner';
import E2eeBanner from '@features/e2ee/components/E2eeBanner';
import { getNickFromMessage } from '@shared/lib/displayName';
import ChatMessage, { contentCategories } from './ChatMessage';

const Chat = () => {
  const { handleContextMenuUserClick } = useContextMenuActions();
  const currentChannelName: string = useSettingsStore((state) => state.currentChannelName);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const isConnected = useSettingsStore((state) => state.isConnected);
  const messages = useCurrentStore((state) => state.messages);
  const fontSizeClass = fontSizeClasses[fontSize];

  const isDebug = currentChannelName === DEBUG_CHANNEL || currentChannelName === STATUS_CHANNEL;

  /**
   * Grouping and date separators are decided by comparing each message with the
   * one before it, so the whole list is walked once here instead of re-deriving
   * the previous message's day and nick inside every row.
   */
  const rows = useMemo(() => {
    const result: { message: Message; currentDate: Date; showDateSeparator: boolean; grouped: boolean }[] = [];
    let prevDayStart: number | null = null;
    let prevNick = '';

    for (const message of messages) {
      const currentDate = startOfDay(new Date(message.time));
      const dayStart = currentDate.getTime();
      const showDateSeparator = prevDayStart !== null && dayStart !== prevDayStart;
      const isContent = contentCategories.has(message.category);
      const nick = getNickFromMessage(message) ?? '';
      // A separator breaks the run, so the message after it starts a fresh group
      const lastNick = showDateSeparator ? '' : prevNick;

      result.push({ message, currentDate, showDateSeparator, grouped: !isDebug && isContent && lastNick === nick });

      prevDayStart = dayStart;
      prevNick = isContent ? nick : '';
    }

    return result;
  }, [messages, isDebug]);

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
      <E2eeBanner />
      {!isConnected && messages.length === 0 && <NotConnected />}
      <div className="pt-0 pb-0">
        {rows.map(({ message, showDateSeparator, currentDate, grouped }) => {
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
