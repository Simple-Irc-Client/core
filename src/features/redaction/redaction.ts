import { isCapabilityEnabled } from '@/network/irc/capabilities';
import { ircSendCommand } from '@/network/irc/network';
import { getMessages, setUpdateMessage } from '@features/channels/store/channels';
import { type Message } from '@shared/types';

// https://ircv3.net/specs/extensions/message-redaction
export const REDACTION_CAPABILITY = 'draft/message-redaction';

/** Channel modes that let servers delete anyone's message in the channel: op and above */
const CAN_REDACT_OTHERS = new Set(['o', 'a', 'q']);

export const canRedactOthers = (channelFlags: string[] | undefined): boolean =>
  channelFlags?.some((flag) => CAN_REDACT_OTHERS.has(flag)) ?? false;

export const isRedactionEnabled = (): boolean => isCapabilityEnabled(REDACTION_CAPABILITY);

/** A deleted message keeps its place, without its text and what hangs off it */
const REDACTED = { message: '', reactions: undefined, redacted: true } satisfies Partial<Message>;

export const redacted = (message: Message): Message => ({ ...message, ...REDACTED });

/** Marks the shown message with that msgid in `window` deleted */
export const setRedacted = (window: string, msgid: string): void => {
  const message = getMessages(window).find((shown) => shown.msgid === msgid);
  if (message !== undefined && message.redacted !== true) {
    setUpdateMessage(window, message.id, REDACTED);
  }
};

/** The server relays REDACT back once it deleted the message, and FAIL when it won't */
export const sendRedaction = (message: Message): void => {
  if (message.msgid !== undefined) {
    ircSendCommand(`REDACT ${message.target} ${message.msgid}`, { window: message.target });
  }
};
