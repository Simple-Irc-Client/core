import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { Message } from '@shared/types';
import { isSameName } from '@features/settings/store/settings';
import { requestOlderHistory } from '@/network/irc/chatHistory';
import { clearGoToMessage, useGoToMessageStore } from '@features/chat/store/goToMessage';

// Close enough to the top that the older page is usually in before the user gets there
const LOAD_OLDER_THRESHOLD_PX = 200;

// This close to the bottom the view follows new messages
const AT_BOTTOM_PX = 50;

// How long a message gone to from a reply or a search result stays marked
const SHOWN_MESSAGE_MARK_MS = 2000;

// The message itself: a date separator can appear above it in the same row once older messages go in
const messageTop = (row: HTMLElement): number => (row.lastElementChild ?? row).getBoundingClientRect().top;

interface ChatScroll {
  containerRef: RefObject<HTMLDivElement | null>;
  handleScroll: () => void;
  /** More than a screen above the newest messages: a button takes the user back */
  isFarFromBottom: boolean;
  jumpToBottom: () => void;
  /** Goes to the message, paging back through history for it when it is not loaded */
  handleShowMessage: (msgid: string) => void;
}

/**
 * Keeps the log at the newest messages unless the user scrolled up, keeps what they read in place as older
 * messages go in above it, and pages back through history as they near the top.
 */
export const useChatScroll = (currentChannelName: string, messages: Message[], isConnected: boolean): ChatScroll => {
  const soughtMessage = useGoToMessageStore((state) => state.sought);
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);
  const lastScrollTop = useRef(0);
  const [isFarFromBottom, setIsFarFromBottom] = useState(false);

  const updateFarFromBottom = useCallback(() => {
    const container = containerRef.current;
    if (container) {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setIsFarFromBottom(scrollHeight - scrollTop - clientHeight > clientHeight);
    }
  }, []);
  /** The first message and where it was on screen, to keep it there when older ones go in above */
  const topMessage = useRef<{ id: string; top: number } | null>(null);

  const rememberTopMessage = useCallback(() => {
    const first = containerRef.current?.querySelector<HTMLElement>('[data-message-id]');
    topMessage.current = first?.dataset.messageId !== undefined ? { id: first.dataset.messageId, top: messageTop(first) } : null;
  }, []);

  /** A message a reply was clicked for, being looked for in older history */
  const soughtMsgid = useRef<string | undefined>(undefined);

  /** Scrolls to the message and marks it a moment; false when it is not shown */
  const showMessage = useCallback((msgid: string): boolean => {
    const container = containerRef.current;
    const row = container?.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(msgid)}"] .sic-msg`);
    if (!container || !row) {
      return false;
    }
    row.scrollIntoView({ block: 'center' });
    // The view stays there: a scroll event can't tell this from a move down when it lands below where the previous window was
    const { scrollTop, scrollHeight, clientHeight } = container;
    isUserScrolledUp.current = scrollHeight - scrollTop - clientHeight > AT_BOTTOM_PX;
    lastScrollTop.current = scrollTop;
    row.dataset.shown = '';
    setTimeout(() => { delete row.dataset.shown; }, SHOWN_MESSAGE_MARK_MS);
    return true;
  }, []);

  const handleShowMessage = useCallback((msgid: string) => {
    if (showMessage(msgid)) {
      soughtMsgid.current = undefined;
      return;
    }
    // Not shown: paged back for until it is, or history has no more
    soughtMsgid.current = requestOlderHistory(currentChannelName) ? msgid : undefined;
  }, [currentChannelName, showMessage]);

  const scrollToBottom = useCallback(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      if (distanceFromBottom <= AT_BOTTOM_PX) {
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
      updateFarFromBottom();
    }
  }, [currentChannelName, rememberTopMessage, updateFarFromBottom]);

  const jumpToBottom = useCallback(() => {
    isUserScrolledUp.current = false;
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  useLayoutEffect(() => {
    isUserScrolledUp.current = false;
    soughtMsgid.current = undefined;
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
    // Messages coming in while scrolled up move the bottom away without a scroll event
    updateFarFromBottom();
  }, [messages, scrollToBottom, rememberTopMessage, updateFarFromBottom]);

  // After the effect above, so finding the sought message moves the view to it rather than back to the bottom
  useLayoutEffect(() => {
    if (soughtMsgid.current !== undefined) {
      handleShowMessage(soughtMsgid.current);
    }
  }, [messages, handleShowMessage]);

  // Once its window shows; one dropped from the window meanwhile isn't waited for
  useLayoutEffect(() => {
    if (soughtMessage !== undefined && isSameName(soughtMessage.channelName, currentChannelName)) {
      showMessage(soughtMessage.messageId);
      clearGoToMessage();
    }
  }, [soughtMessage, currentChannelName, showMessage]);

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

  return { containerRef, handleScroll, isFarFromBottom, jumpToBottom, handleShowMessage };
};
