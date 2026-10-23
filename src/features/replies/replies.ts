import { isClientTagAllowed } from '@/network/irc/clientTags';
import { escapeTagValue } from '@/network/irc/helpers';
import { getClientTagDeny } from '@features/settings/store/settings';
import { getNickFromMessage } from '@shared/lib/displayName';
import { stripIrcFormatting } from '@shared/lib/ircFormatting';
import { type Message } from '@shared/types';

// https://ircv3.net/specs/client-tags/reply
export const REPLY_TAG = '+draft/reply';

/** Marks a line quoting another, as many clients write and show it */
export const QUOTE_PREFIX = '> ';

// Keeps the quote and the nick within one IRC line
const MAX_QUOTED_LENGTH = 120;

/** The tags of a reply to `message`, or none where the server would not relay it or the message has no msgid */
export const replyTags = (message: Message): string | undefined =>
  message.msgid !== undefined && isClientTagAllowed('draft/reply', getClientTagDeny())
    ? `@${REPLY_TAG}=${escapeTagValue(message.msgid)}`
    : undefined;

/** The text a reply quotes the message by where it can't refer to it: `> <nick> text` */
export const quoteLine = (message: Message): string => {
  const text = stripIrcFormatting(message.message).replaceAll(/\s+/g, ' ').trim();
  const quoted = text.length > MAX_QUOTED_LENGTH ? `${text.slice(0, MAX_QUOTED_LENGTH - 1)}…` : text;
  return `${QUOTE_PREFIX}<${getNickFromMessage(message) ?? ''}> ${quoted}`;
};
