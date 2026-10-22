// https://ircv3.net/specs/extensions/chathistory

import { maxMessages, maxViewedMessages } from '@/config/config';
import { isCapabilityEnabled } from '@/network/irc/capabilities';
import { type ChatHistoryReference, ircRequestChatHistory } from '@/network/irc/network';
import { getCategory, getMessages } from '@features/channels/store/channels';
import { getCaseMapping, getChatHistoryLimit, getCurrentNick, isSameName } from '@features/settings/store/settings';
import { foldName } from '@shared/lib/caseMapping';
import { ChannelCategory, type Message } from '@shared/types';

const PAGE_SIZE = 50;

/** A message history is paged back from */
export interface HistoryAnchor {
  time: number;
  /** The server's id: exact even among messages sharing a millisecond */
  msgid?: string;
}

interface PendingRequest {
  /** Messages asked for: an answer with fewer has nothing more in that direction */
  limit: number;
  /** Catching up after a reconnect: page back until this time, the newest message we already had */
  since?: number;
  /** Messages received so far while catching up */
  fetched: number;
  /** What a BEFORE request pages back from */
  before?: HistoryAnchor;
}

/** One request per window at a time, so a chathistory batch for a window answers its request */
const pending = new Map<string, PendingRequest>();
/** The server has nothing older than this */
const historyStart = new Map<string, number>();
/** Whether the server tags history with msgids, so stored message ids can anchor a request */
let serverHasMsgids = false;

const keyOf = (target: string): string => foldName(target, getCaseMapping());

// A server may cap how many messages one request returns
const pageSize = (): number => {
  const limit = getChatHistoryLimit();
  return limit > 0 ? Math.min(PAGE_SIZE, limit) : PAGE_SIZE;
};

// Messages from others carry the server's time and id; ours and local notices may carry our clock and a local id
const fromServer = (target: string): HistoryAnchor[] => {
  const myNick = getCurrentNick();
  return getMessages(target)
    .filter((message: Message) => {
      const nick = typeof message.nick === 'string' ? message.nick : message.nick?.nick;
      return nick !== undefined && !isSameName(nick, myNick);
    })
    .map((message) => ({ time: Date.parse(message.time), msgid: serverHasMsgids ? message.id : undefined }))
    .filter((anchor) => !Number.isNaN(anchor.time));
};

// Timestamp bounds are exclusive and a burst shares a millisecond: 1ms wider keeps its other messages, and repeats are dropped by msgid
const referenceTo = (subcommand: 'LATEST' | 'BEFORE', anchor: HistoryAnchor | undefined): ChatHistoryReference | undefined => {
  if (anchor === undefined) {
    return undefined;
  }
  if (anchor.msgid !== undefined) {
    return { msgid: anchor.msgid };
  }
  return { timestamp: new Date(subcommand === 'BEFORE' ? anchor.time + 1 : anchor.time - 1).toISOString() };
};

const send = (target: string, subcommand: 'LATEST' | 'BEFORE', anchor: HistoryAnchor | undefined, request: Omit<PendingRequest, 'limit'>): void => {
  const limit = pageSize();
  pending.set(keyOf(target), { ...request, limit });
  ircRequestChatHistory(target, subcommand, referenceTo(subcommand, anchor), limit);
};

/** On joining: the latest messages, and everything since the newest one we already had */
export const requestLatestHistory = (target: string): void => {
  if (!isCapabilityEnabled('draft/chathistory')) {
    return;
  }
  const times = fromServer(target).map((anchor) => anchor.time);
  const since = times.length > 0 ? Math.max(...times) : undefined;
  // By time: the newest message we had may be gone from the server's history by now
  send(target, 'LATEST', since === undefined ? undefined : { time: since }, { since, fetched: 0 });
};

/** Scrolled to the top of a window: the page before its oldest message */
export const requestOlderHistory = (target: string): void => {
  const key = keyOf(target);
  const category = getCategory(target);
  if (!isCapabilityEnabled('draft/chathistory') || pending.has(key) || (category !== ChannelCategory.channel && category !== ChannelCategory.priv)) {
    return;
  }
  if (getMessages(target).length + pageSize() > maxViewedMessages) {
    return;
  }
  // Shown in the server's order, so the first is the oldest
  const [oldest] = fromServer(target);
  if (oldest === undefined || oldest.time <= (historyStart.get(key) ?? Number.NEGATIVE_INFINITY)) {
    return;
  }
  send(target, 'BEFORE', oldest, { fetched: 0, before: oldest });
};

/** The message the window's outstanding request asked for history before */
export const pendingHistoryAnchor = (target: string): string | undefined => pending.get(keyOf(target))?.before?.msgid;

/** The window's chathistory batch ended: `count` messages, the first (oldest) of them `oldest` */
export const onHistoryBatch = (target: string, count: number, oldest: HistoryAnchor | undefined): void => {
  const key = keyOf(target);
  const request = pending.get(key);
  if (request === undefined) {
    return;
  }
  pending.delete(key);
  serverHasMsgids ||= oldest?.msgid !== undefined;

  const reached = oldest ?? request.before;
  // By time alone, a full page within the anchor's millisecond can't be paged past
  const stuck = request.before !== undefined && reached !== undefined
    && (reached.msgid !== undefined ? reached.msgid === request.before.msgid : reached.time >= request.before.time);

  if (count < request.limit || stuck) {
    // A LATEST bounded by `since` returns only what is newer, which says nothing about where history starts
    const boundedLatest = request.since !== undefined && request.before === undefined;
    if (!boundedLatest) {
      historyStart.set(key, reached?.time ?? Number.POSITIVE_INFINITY);
    }
    return;
  }

  const fetched = request.fetched + count;
  // Anything older than maxMessages back would be trimmed again
  if (request.since !== undefined && oldest !== undefined && oldest.time > request.since && fetched < maxMessages) {
    send(target, 'BEFORE', oldest, { since: request.since, fetched, before: oldest });
  }
};

/** FAIL CHATHISTORY: asking again would fail the same way */
export const onHistoryFailed = (target: string): void => {
  const key = keyOf(target);
  if (pending.delete(key)) {
    historyStart.set(key, Number.POSITIVE_INFINITY);
  }
};

export const clearHistoryRequests = (): void => {
  pending.clear();
  historyStart.clear();
  serverHasMsgids = false;
};
