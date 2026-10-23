import { isCapabilityEnabled } from '@/network/irc/capabilities';
import { escapeTagValue } from '@/network/irc/helpers';
import { ircSendRawMessage } from '@/network/irc/network';
import { getMessages, setUpdateMessage } from '@features/channels/store/channels';
import { getCurrentNick, isSameName } from '@features/settings/store/settings';
import { type Message, type Reaction } from '@shared/types';

// https://ircv3.net/specs/client-tags/react
export const REACT_TAG = '+draft/react';
export const UNREACT_TAG = '+draft/unreact';
export const REPLY_TAG = '+draft/reply';

export const hasReacted = (reaction: Reaction, nick: string): boolean => reaction.nicks.some((reacted) => isSameName(reacted, nick));

/** `nick`'s reaction added or taken back; the same list when nothing changes, and none once nobody reacts */
export const withReaction = (reactions: Reaction[] | undefined, emoji: string, nick: string, isAdded: boolean): Reaction[] | undefined => {
  const existing = reactions?.find((reaction) => reaction.emoji === emoji);
  if (isAdded === (existing !== undefined && hasReacted(existing, nick))) {
    return reactions;
  }

  if (isAdded) {
    return existing === undefined
      ? [...(reactions ?? []), { emoji, nicks: [nick] }]
      : (reactions ?? []).map((reaction) => (reaction === existing ? { emoji, nicks: [...reaction.nicks, nick] } : reaction));
  }

  const remaining = (reactions ?? [])
    .map((reaction) => (reaction === existing ? { emoji, nicks: reaction.nicks.filter((reacted) => !isSameName(reacted, nick)) } : reaction))
    .filter((reaction) => reaction.nicks.length > 0);
  return remaining.length > 0 ? remaining : undefined;
};

/** Applies a reaction to the shown message with that msgid in `window` */
export const setReaction = (window: string, msgid: string, emoji: string, nick: string, isAdded: boolean): void => {
  const message = getMessages(window).find((shown) => shown.msgid === msgid);
  if (message === undefined) {
    return;
  }

  const reactions = withReaction(message.reactions, emoji, nick, isAdded);
  if (reactions !== message.reactions) {
    setUpdateMessage(window, message.id, { reactions });
  }
};

export const sendReaction = (message: Message, emoji: string, isAdded: boolean): void => {
  if (message.msgid === undefined) {
    return;
  }

  const tag = isAdded ? REACT_TAG : UNREACT_TAG;
  ircSendRawMessage(`@${tag}=${escapeTagValue(emoji)};${REPLY_TAG}=${escapeTagValue(message.msgid)} TAGMSG ${message.target}`);

  // With echo-message the server echoes it back and it's applied then
  if (!isCapabilityEnabled('echo-message')) {
    setReaction(message.target, message.msgid, emoji, getCurrentNick(), isAdded);
  }
};
