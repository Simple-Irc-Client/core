import { startOfDay } from 'date-fns';
import type { Message } from '@shared/types';
import { getNickFromMessage } from '@shared/lib/displayName';
import { collapseMembershipEvents, contentCategories, type ChatItem, type MembershipEventsDisplay } from './membershipEvents';

// After this long without a word the author's next message gets its header again
const GROUP_BREAK_MS = 5 * 60 * 1000;

export interface ChatRow {
  item: ChatItem;
  currentDate: Date;
  showDateSeparator: boolean;
  /** Under the previous message's header: same author, same day, and not long after */
  grouped: boolean;
}

export interface ChatRowsOptions {
  /** Status and Debug: every event on a line of its own, and no grouping */
  isDebug: boolean;
  membershipEvents: MembershipEventsDisplay;
  fold: (nick: string) => string;
  myNick: string;
}

/** The window's messages as the rows the log shows, with their date separators and grouping */
export const buildChatRows = (messages: Message[], { isDebug, membershipEvents, fold, myNick }: ChatRowsOptions): ChatRow[] => {
  const items = collapseMembershipEvents(messages, { display: isDebug ? 'all' : membershipEvents, fold, myNick });
  const result: ChatRow[] = [];
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
};
