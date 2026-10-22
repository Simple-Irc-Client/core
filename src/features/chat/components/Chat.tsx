import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useSettingsStore, fontSizeClasses } from '@features/settings/store/settings';
import { startOfDay } from 'date-fns';
import type { Message } from '@shared/types';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { requestOlderHistory } from '@/network/irc/chatHistory';
import { useCurrentStore } from '@features/chat/store/current';
import DateSeparator from './DateSeparator';
import { useContextMenuActions } from '@/providers/ContextMenuContext';
import NotConnected from './NotConnected';
import DisconnectedBanner from './DisconnectedBanner';
import E2eeBanner from '@features/e2ee/components/E2eeBanner';
import { getNickFromMessage } from '@shared/lib/displayName';
import ChatMessage, { contentCategories } from './ChatMessage';

// Close enough to the top that the older page is usually in before the user gets there
const LOAD_OLDER_THRESHOLD_PX = 200;

// The message itself: a date separator can appear above it in the same row once older messages go in
const messageTop = (row: HTMLElement): number => (row.lastElementChild ?? row).getBoundingClientRect().top;

const Chat = () => {
  const { handleContextMenuUserClick } = useContextMenuActions();
  const currentChannelName: string = useSettingsStore((state) => state.currentChannelName);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const isConnected = useSettingsStore((state) => state.isConnected);
  const messages = useCurrentStore((state) => state.messages);
  const fontSizeClass = fontSizeClasses[fontSize];

  const isDebug = currentChannelName === DEBUG_CHANNEL || currentChannelName === STATUS_CHANNEL;

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
      const lastNick = showDateSeparator ? '' : prevNick;

      result.push({ message, currentDate, showDateSeparator, grouped: !isDebug && isContent && lastNick === nick });

      prevDayStart = dayStart;
      prevNick = isContent ? nick : '';
    }

    return result;
  }, [messages, isDebug]);

  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);
  const lastScrollTop = useRef(0);
  /** The first message and where it was on screen, to keep it there when older ones go in above */
  const topMessage = useRef<{ id: string; top: number } | null>(null);

  const rememberTopMessage = useCallback(() => {
    const first = containerRef.current?.querySelector<HTMLElement>('[data-message-id]');
    topMessage.current = first?.dataset.messageId !== undefined ? { id: first.dataset.messageId, top: messageTop(first) } : null;
  }, []);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      if (distanceFromBottom <= 50) {
        isUserScrolledUp.current = false;
      } else if (scrollTop < lastScrollTop.current) {
        // Only an upward move is the user's: scroll anchoring moves the view down when content above it grows (images, theme change)
        isUserScrolledUp.current = true;
        if (scrollTop <= LOAD_OLDER_THRESHOLD_PX) {
          requestOlderHistory(currentChannelName);
        }
      }
      lastScrollTop.current = scrollTop;
      rememberTopMessage();
    }
  }, [currentChannelName, rememberTopMessage]);

  useLayoutEffect(() => {
    isUserScrolledUp.current = false;
    scrollToBottom();
  }, [currentChannelName, scrollToBottom]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const previous = topMessage.current;
    if (!isUserScrolledUp.current) {
      scrollToBottom();
    } else if (container && previous) {
      // Not every engine anchors scrolling (WebKit doesn't), and where one does this finds nothing left to move
      const element = container.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(previous.id)}"]`);
      if (element) {
        container.scrollTop += messageTop(element) - previous.top;
      }
    }
    rememberTopMessage();
  }, [messages, scrollToBottom, rememberTopMessage]);

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
      <div className="sticky top-0 z-10 break-normal">
        {!isConnected && <DisconnectedBanner />}
        <E2eeBanner />
      </div>
      {!isConnected && messages.length === 0 && <NotConnected />}
      <div className="pt-0 pb-0">
        {rows.map(({ message, showDateSeparator, currentDate, grouped }) => {
          return (
            <div key={`message-${message.id}`} data-message-id={message.id}>
              {showDateSeparator && <DateSeparator date={currentDate} fontSizeClass={fontSizeClass} />}
              <ChatMessage message={message} grouped={grouped} isDebug={isDebug} fontSizeClass={fontSizeClass} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Chat;
