import { isCapabilityEnabled } from '@/network/irc/capabilities';
import { type IrcContext } from '@/network/irc/kernel/context';
import { markReadSoon, noteShownMessage } from '@/network/irc/readMarkers';
import { notifyHighlight } from '@/runtime/notifications';
import { existChannel, isChannel, setAddChannel, setHasMention } from '@features/channels/store/channels';
import { subscribeDmPresence } from '@features/dmPresence/dmPresence';
import { playHighlightSound } from '@features/sounds/sounds';
import { plainText } from '@features/chat/spoilers';
import { getHighlightWords, isSameName } from '@features/settings/store/settings';
import { containsHighlight } from '@shared/lib/highlight';
import { ChannelCategory } from '@shared/types';

export interface Conversation {
  /** The window it belongs in: the channel, or the peer's nick for a DM */
  window: string;
  isDirect: boolean;
  /** Sent by us, from this client or another one on the same bouncer (IRCv3 echo-message, znc.in/self-message) */
  isOwn: boolean;
  /** Our own message, echoed back by the server (IRCv3 echo-message) */
  isEcho: boolean;
}

export const resolveConversation = (nick: string, target: string, myNick: string): Conversation => {
  const isOwn = isSameName(nick, myNick);
  return {
    window: isSameName(target, myNick) ? nick : target,
    // Addressed to us, or our own message to a non-channel target
    isDirect: isSameName(target, myNick) || (isOwn && !isChannel(target)),
    isOwn,
    isEcho: isOwn && isCapabilityEnabled('echo-message'),
  };
};

export const openConversationWindow = ({ window, isDirect }: Conversation): void => {
  if (!existChannel(window)) {
    setAddChannel(window, isDirect ? ChannelCategory.priv : ChannelCategory.channel);
    if (isDirect) {
      subscribeDmPresence(window);
    }
  }
};

export const mentionsMe = (text: string, myNick: string): boolean => containsHighlight(text, [myNick, ...getHighlightWords()]);

export const isHighlight = ({ isDirect, isOwn }: Conversation, text: string, myNick: string): boolean =>
  !isOwn && (isDirect || mentionsMe(text, myNick));

export const announceHighlight = ({ window, isDirect }: Conversation, nick: string, text: string, currentChannelName: string): void => {
  if (window !== currentChannelName) {
    setHasMention(window);
  }
  playHighlightSound(window, isDirect);
  void notifyHighlight({ nick, target: window, message: plainText(text), isDirect });
};

export const trackReadPosition = (ctx: IrcContext, window: string, currentChannelName: string): void => {
  // Without server-time there is nothing to put in a read marker
  if (ctx.tags.time === undefined) {
    return;
  }
  noteShownMessage(window, ctx.tags.time);
  if (!ctx.isHistory && isSameName(window, currentChannelName)) {
    markReadSoon(window);
  }
};
