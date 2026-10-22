import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { getReadMarker, markRead, setReadMarker } from '@/network/irc/readMarkers';
import { existChannel, getMessages, setUnreadMessages } from '@features/channels/store/channels';
import { getCurrentChannelName, getCurrentNick, isSameName } from '@features/settings/store/settings';
import { type Message, MessageCategory } from '@shared/types';

const isUnreadCandidate = (message: Message, myNick: string): boolean => {
  const nick = typeof message.nick === 'string' ? message.nick : message.nick?.nick;
  return (message.category === MessageCategory.default || message.category === MessageCategory.me)
    && message.system !== true
    && nick !== undefined
    && !isSameName(nick, myNick);
};

/** Unread state follows the marker, which another client of ours may have moved */
export const applyReadMarker = (target: string): void => {
  if (!existChannel(target)) {
    return;
  }

  if (isSameName(target, getCurrentChannelName())) {
    markRead(target);
    return;
  }

  const marker = getReadMarker(target);
  if (marker === undefined) {
    return;
  }

  const readUntil = Date.parse(marker);
  const myNick = getCurrentNick();
  const unread = getMessages(target).filter((message) => isUnreadCandidate(message, myNick) && Date.parse(message.time) > readUntil);
  setUnreadMessages(target, unread.length, unread.some((message) => message.highlight === true));
};

// @time=2026-10-22T06:29:02.129Z :ergo.test MARKREAD #rm timestamp=2026-01-01T00:00:00.000Z
// @time=2026-10-22T06:28:52.413Z :ergo.test MARKREAD #rm *
export const onMarkRead = (ctx: IrcContext): void => {
  const target = ctx.line.shift();

  if (target === undefined) {
    ctx.logParseError(onMarkRead, 'target');
    return;
  }

  const value = ctx.trailing();

  // Nothing read yet
  if (value === '*') {
    return;
  }

  const time = value.startsWith('timestamp=') ? value.substring('timestamp='.length) : '';
  if (Number.isNaN(Date.parse(time))) {
    ctx.logParseError(onMarkRead, 'timestamp');
    return;
  }

  setReadMarker(target, time);
  applyReadMarker(target);
};

export const handlers: IrcHandlers = {
  MARKREAD: onMarkRead,
};
