import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown } from 'lucide-react';
import { useSettingsStore, fontSizeClasses, isSameName } from '@features/settings/store/settings';
import { startOfDay } from 'date-fns';
import type { Message } from '@shared/types';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { requestOlderHistory } from '@/network/irc/chatHistory';
import { useCurrentStore } from '@features/chat/store/current';
import { clearGoToMessage, useGoToMessageStore } from '@features/chat/store/goToMessage';
import DateSeparator from './DateSeparator';
import { useContextMenuActions } from '@/providers/ContextMenuContext';
import NotConnected from './NotConnected';
import DisconnectedBanner from './DisconnectedBanner';
import E2eeBanner from '@features/e2ee/components/E2eeBanner';
import NickRegainBanner from '@features/nickRegain/components/NickRegainBanner';
import { getNickFromMessage } from '@shared/lib/displayName';
import ChatMessage from './ChatMessage';
import MembershipEventsRow from './MembershipEventsRow';
import { timeWidthCh } from './MessageTime';
import { collapseMembershipEvents, contentCategories, type ChatItem } from '../membershipEvents';
import { foldName } from '@shared/lib/caseMapping';
import ReactionPicker, { type ReactionPickerHandle } from '@features/reactions/components/ReactionPicker';
import RedactDialog from '@features/redaction/components/RedactDialog';
import { canRedactOthers, isRedactionEnabled } from '@features/redaction/redaction';
import { useUsersStore } from '@features/users/store/users';
import { useCanReact } from '@features/reactions/useCanReact';
import { useCanSendPlaintext } from '@features/chat/useCanSendPlaintext';
import { setReplyTo } from '@features/replies/store/replyTo';
import { Button } from '@shared/components/ui/button';

// Close enough to the top that the older page is usually in before the user gets there
const LOAD_OLDER_THRESHOLD_PX = 200;

// This close to the bottom the view follows new messages
const AT_BOTTOM_PX = 50;

// How long a message gone to from a reply or a search result stays marked
const SHOWN_MESSAGE_MARK_MS = 2000;

// After this long without a word the author's next message gets its header again
const GROUP_BREAK_MS = 5 * 60 * 1000;

// The message itself: a date separator can appear above it in the same row once older messages go in
const messageTop = (row: HTMLElement): number => (row.lastElementChild ?? row).getBoundingClientRect().top;

const Chat = () => {
  const { t } = useTranslation();
  const { handleContextMenuUserClick } = useContextMenuActions();
  const currentChannelName: string = useSettingsStore((state) => state.currentChannelName);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const isConnected = useSettingsStore((state) => state.isConnected);
  const messages = useCurrentStore((state) => state.messages);
  const membershipEvents = useSettingsStore((state) => state.membershipEvents);
  const myNick = useSettingsStore((state) => state.nick);
  const caseMapping = useSettingsStore((state) => state.caseMapping);
  const density = useSettingsStore((state) => state.density);
  const timeFormat = useSettingsStore((state) => state.timeFormat);
  const showSeconds = useSettingsStore((state) => state.showSeconds);
  const soughtMessage = useGoToMessageStore((state) => state.sought);
  const fold = useCallback((nick: string) => foldName(nick, caseMapping), [caseMapping]);
  /** The event runs shown line by line, by the id of their first event */
  const [expandedRuns, setExpandedRuns] = useState<ReadonlySet<string>>(() => new Set());
  const fontSizeClass = fontSizeClasses[fontSize];
  const canReact = useCanReact(currentChannelName);
  const reactionPicker = useRef<ReactionPickerHandle>(null);

  const handleAddReaction = useCallback((message: Message, anchor: HTMLElement) => reactionPicker.current?.open(message, anchor), []);
  const handleReply = useCallback((message: Message) => setReplyTo(message.target, message), []);
  const [redacting, setRedacting] = useState<Message>();
  const handleRedact = useCallback((message: Message) => setRedacting(message), []);
  const closeRedact = useCallback(() => setRedacting(undefined), []);

  const isDebug = currentChannelName === DEBUG_CHANNEL || currentChannelName === STATUS_CHANNEL;
  const canReply = useCanSendPlaintext(currentChannelName) && !isDebug;
  const myChannelFlags = useUsersStore((state) =>
    state.users.find((user) => fold(user.nick) === fold(myNick))?.channels.find((channel) => fold(channel.name) === fold(currentChannelName))?.flags);
  const canRedactHere = !isDebug && isRedactionEnabled();
  const canRedactAny = canRedactHere && canRedactOthers(myChannelFlags);

  const rows = useMemo(() => {
    const items = collapseMembershipEvents(messages, { display: isDebug ? 'all' : membershipEvents, fold, myNick });
    const result: { item: ChatItem; currentDate: Date; showDateSeparator: boolean; grouped: boolean }[] = [];
    let prevDayStart: number | null = null;
    let prevNick = '';
    let prevTime = 0;

    for (const item of items) {
      const message = item.kind === 'message' ? item.message : item.messages[0];
      if (message === undefined) { continue; }
      const currentDate = startOfDay(new Date(message.time));
      const dayStart = currentDate.getTime();
      const showDateSeparator = prevDayStart !== null && dayStart !== prevDayStart;
      const isContent = item.kind === 'message' && contentCategories.has(message.category);
      const nick = getNickFromMessage(message) ?? '';
      const time = new Date(message.time).getTime();
      const lastNick = showDateSeparator || time - prevTime > GROUP_BREAK_MS ? '' : prevNick;

      // A reply shows what it answers above its header
      const grouped = !isDebug && isContent && lastNick === nick && message.replyTo === undefined;
      result.push({ item, currentDate, showDateSeparator, grouped });

      prevDayStart = dayStart;
      prevNick = isContent ? nick : '';
      prevTime = time;
    }

    return result;
  }, [messages, isDebug, membershipEvents, fold, myNick]);

  const toggleRun = useCallback((id: string) => {
    setExpandedRuns((expanded) => {
      const next = new Set(expanded);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }, []);

  const messagesByMsgid = useMemo(() => new Map(messages.flatMap((message) => (message.msgid === undefined ? [] : [[message.msgid, message] as const]))), [messages]);

  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUp = useRef(false);
  const lastScrollTop = useRef(0);
  /** More than a screen above the newest messages: a button takes the user back */
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

  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        data-testid="chat-log"
        role="log"
        data-density={density}
        style={{ '--sic-time-width': `${timeWidthCh({ timeFormat, showSeconds })}ch` } as React.CSSProperties}
        onScroll={handleScroll}
        onContextMenu={(e) => {
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
          <NickRegainBanner />
          <E2eeBanner />
        </div>
        {!isConnected && messages.length === 0 && <NotConnected />}
        <div className="pt-0 pb-0">
          {rows.map(({ item, showDateSeparator, currentDate, grouped }) => {
            const renderMessage = (message: Message, isGrouped: boolean) => (
              <ChatMessage
                message={message}
                grouped={isGrouped}
                isDebug={isDebug}
                fontSizeClass={fontSizeClass}
                canReact={canReact}
                onAddReaction={handleAddReaction}
                canReply={canReply}
                onReply={handleReply}
                replied={message.replyTo === undefined ? undefined : messagesByMsgid.get(message.replyTo)}
                onShowMessage={handleShowMessage}
                canRedact={canRedactAny || (canRedactHere && fold(getNickFromMessage(message) ?? '') === fold(myNick))}
                onRedact={handleRedact}
              />
            );
            if (item.kind === 'message') {
              return (
                <div key={`message-${item.message.id}`} data-message-id={item.message.id}>
                  {showDateSeparator && <DateSeparator date={currentDate} fontSizeClass={fontSizeClass} />}
                  {renderMessage(item.message, grouped)}
                </div>
              );
            }
            const expanded = expandedRuns.has(item.id);
            return (
              // The last event's id: older history going in above can lengthen a run, but never changes its last event
              <div key={`events-${item.id}`} data-message-id={item.messages.at(-1)?.id}>
                {showDateSeparator && <DateSeparator date={currentDate} fontSizeClass={fontSizeClass} />}
                <MembershipEventsRow id={item.id} events={item.messages} expanded={expanded} onToggle={toggleRun} fontSizeClass={fontSizeClass} fold={fold} />
                {expanded && item.messages.map((message) => (
                  <div key={`message-${message.id}`} data-message-id={message.id}>
                    {renderMessage(message, false)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        {/* Keyed, so switching windows closes it */}
        <ReactionPicker key={currentChannelName} ref={reactionPicker} />
        <RedactDialog message={redacting} onClose={closeRedact} />
      </div>
      {isFarFromBottom && (
        <Button
          variant="secondary"
          size="icon"
          onClick={jumpToBottom}
          className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full shadow-md"
          aria-label={t('main.chat.jumpToBottom')}
          title={t('main.chat.jumpToBottom')}
        >
          <ArrowDown />
        </Button>
      )}
    </div>
  );
};

export default Chat;
