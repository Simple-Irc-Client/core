import { MessageColor } from '@/config/theme';
import { isIrcService } from '@/network/irc/helpers';
import { existChannel, isChannel, setAddChannel, setAddMessage } from '@features/channels/store/channels';
import { subscribeDmPresence } from '@features/dmPresence/dmPresence';
import { getCurrentNick } from '@features/settings/store/settings';
import { getUser } from '@features/users/store/users';
import { ChannelCategory, MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

// eslint-disable-next-line no-control-regex
export const ACTION_BODY = /^\x01ACTION (.*)\x01$/;
// Case-insensitive so a hand-typed lowercase `/quote privmsg` can't slip past the E2EE gate as plaintext
export const PRIVMSG_OR_NOTICE = /^(PRIVMSG|NOTICE) (\S+) :([\s\S]*)$/i;

/** Where the server's echo would have put it: a notice in the open channel or the current window, a message in its target's window. */
const windowFor = (isNotice: boolean, target: string, currentWindow: string): string => {
  if (!isNotice) {
    return target;
  }
  return isChannel(target) && existChannel(target) ? target : currentWindow;
};

const styleFor = (isAction: boolean, isNotice: boolean) => {
  if (isAction) {
    return { category: MessageCategory.me, color: MessageColor.me };
  }
  if (isNotice) {
    return { category: MessageCategory.notice, color: MessageColor.notice };
  }
  return { category: MessageCategory.default, color: MessageColor.default };
};

const openWindow = (window: string): void => {
  if (existChannel(window)) {
    return;
  }
  const isDirect = !isChannel(window);
  setAddChannel(window, isDirect ? ChannelCategory.priv : ChannelCategory.channel);
  if (isDirect) {
    subscribeDmPresence(window);
  }
};

/**
 * Shows the PRIVMSG and NOTICE lines a command sends, for servers without echo-message, the way their echo would be shown.
 * CTCP other than ACTION and anything sent to services stay hidden, as their echoes do.
 */
export const showOwnCommandMessages = (payload: string, currentWindow: string): void => {
  const nick = getCurrentNick();

  for (const line of payload.split('\n')) {
    const match = PRIVMSG_OR_NOTICE.exec(line);
    if (!match) {
      continue;
    }
    const [, verb = '', target = '', body = ''] = match;
    const action = ACTION_BODY.exec(body)?.[1];
    if (isIrcService(target) || (body.startsWith('\x01') && action === undefined)) {
      continue;
    }

    const isNotice = verb.toUpperCase() === 'NOTICE';
    const window = windowFor(isNotice, target, currentWindow);
    openWindow(window);

    setAddMessage({
      id: uuidv4(),
      message: action ?? body,
      nick: getUser(nick) ?? nick,
      target: window,
      time: new Date().toISOString(),
      ...styleFor(action !== undefined, isNotice),
    });
  }
};
