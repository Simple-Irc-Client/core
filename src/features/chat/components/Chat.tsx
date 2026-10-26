import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown } from 'lucide-react';
import { useSettingsStore, fontSizeClasses } from '@features/settings/store/settings';
import { useActiveSession } from '@features/networks/store/networks';
import type { Message } from '@shared/types';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { useCurrentStore } from '@features/chat/store/current';
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
import { buildChatRows } from '../chatRows';
import { useChatScroll } from '../useChatScroll';
import { foldName } from '@shared/lib/caseMapping';
import ReactionPicker, { type ReactionPickerHandle } from '@features/reactions/components/ReactionPicker';
import RedactDialog from '@features/redaction/components/RedactDialog';
import { canRedactOthers, isRedactionEnabled } from '@features/redaction/redaction';
import { useActiveUsers } from '@features/users/store/users';
import { useCanReact } from '@features/reactions/useCanReact';
import { useCanSendPlaintext } from '@features/chat/useCanSendPlaintext';
import { setReplyTo } from '@features/replies/store/replyTo';
import { Button } from '@shared/components/ui/button';

const Chat = () => {
  const { t } = useTranslation();
  const { handleContextMenuUserClick } = useContextMenuActions();
  const currentChannelName: string = useActiveSession((session) => session.currentChannelName);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const isConnected = useActiveSession((session) => session.isConnected);
  const messages = useCurrentStore((state) => state.messages);
  const membershipEvents = useSettingsStore((state) => state.membershipEvents);
  const myNick = useActiveSession((session) => session.nick);
  const caseMapping = useActiveSession((session) => session.caseMapping);
  const density = useSettingsStore((state) => state.density);
  const timeFormat = useSettingsStore((state) => state.timeFormat);
  const showSeconds = useSettingsStore((state) => state.showSeconds);
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
  const myChannelFlags = useActiveUsers((slice) =>
    slice.users.find((user) => fold(user.nick) === fold(myNick))?.channels.find((channel) => fold(channel.name) === fold(currentChannelName))?.flags);
  const canRedactHere = !isDebug && isRedactionEnabled();
  const canRedactAny = canRedactHere && canRedactOthers(myChannelFlags);

  const rows = useMemo(() => buildChatRows(messages, { isDebug, membershipEvents, fold, myNick }), [messages, isDebug, membershipEvents, fold, myNick]);

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

  const { containerRef, handleScroll, isFarFromBottom, jumpToBottom, handleShowMessage } = useChatScroll(currentChannelName, messages, isConnected);

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
