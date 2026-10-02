import { BATCH_TYPES, type BatchState, endBatch, startBatch } from '@/network/irc/batch';
import { takeLabel } from '@/network/irc/labels';
import { IrcContext, type IrcHandler, type IrcHandlers } from '@/network/irc/kernel/context';
import { onJoin } from '@/network/irc/kernel/core/channel/join';
import { onKick } from '@/network/irc/kernel/core/channel/kick';
import { onTopic } from '@/network/irc/kernel/core/channel/topic';
import { onNotice, onPrivMsg } from '@/network/irc/kernel/core/message';
import { onMode } from '@/network/irc/kernel/core/mode';
import { onAway } from '@/network/irc/kernel/core/user/away';
import { onNick } from '@/network/irc/kernel/core/user/nick';
import { onPart } from '@/network/irc/kernel/core/user/part';
import { onQuit } from '@/network/irc/kernel/core/user/quit';
import { onAccount } from '@/network/irc/kernel/ircv3/account';
import { onChghost } from '@/network/irc/kernel/ircv3/chghost';
import { onMetadata } from '@/network/irc/kernel/ircv3/metadata';
import { onSetname } from '@/network/irc/kernel/ircv3/setname';
import { onTagMsg } from '@/network/irc/kernel/ircv3/typing';
import { type ParsedIrcRawMessage } from '@shared/types';

// :netsplit.pirc.pl BATCH +0G9Zyu0qr7Jem5SdPufanF chathistory #sic
// :netsplit.pirc.pl BATCH -0G9Zyu0qr7Jem5SdPufanF
// BATCH +reference type [params...]
// BATCH -reference
export const onBatch = (ctx: IrcContext): void => {
  const reference = ctx.line.shift();

  if (!reference) { return; }

  if (reference.startsWith('+')) {
    const id = reference.substring(1);
    const type = ctx.line.shift() ?? '';
    const params = [...ctx.line];

    const label = ctx.tags.label;

    startBatch(id, type, params, label !== undefined ? takeLabel(label) : undefined);
  } else if (reference.startsWith('-')) {
    const id = reference.substring(1);
    const batch = endBatch(id);

    if (batch) {
      processBatch(ctx, batch);
    }
  }
};

export const processBatch = (ctx: IrcContext, batch: BatchState): void => {
  switch (batch.type) {
    case BATCH_TYPES.CHATHISTORY:
      processChatHistoryBatch(ctx, batch);
      break;
    case BATCH_TYPES.LABELED_RESPONSE:
      // Its messages were handled as they arrived
      break;
    case BATCH_TYPES.NETJOIN:
    case BATCH_TYPES.NETSPLIT:
      for (const message of batch.messages) {
        processBufferedMessage(ctx, message);
      }
      break;
    default:
      // Unknown batch type
      for (const message of batch.messages) {
        processBufferedMessage(ctx, message);
      }
  }
};

/** Inserts at the beginning of the channel */
export const processChatHistoryBatch = (ctx: IrcContext, batch: BatchState): void => {
  const target = batch.params[0];
  if (!target) { return; }

  // Skip TAGMSG: typing indicators from history are stale
  for (const message of batch.messages) {
    if (message.command === 'TAGMSG') { continue; }
    processBufferedMessage(ctx, message);
  }
};

// Commands replayed from a finished batch; numerics inside batches are not replayed
const bufferedHandlers = new Map<string, IrcHandler>([
  ['ACCOUNT', onAccount],
  ['AWAY', onAway],
  ['CHGHOST', onChghost],
  ['JOIN', onJoin],
  ['KICK', onKick],
  ['METADATA', onMetadata],
  ['MODE', onMode],
  ['NICK', onNick],
  ['NOTICE', onNotice],
  ['PART', onPart],
  ['PRIVMSG', onPrivMsg],
  ['QUIT', onQuit],
  ['SETNAME', onSetname],
  ['TAGMSG', onTagMsg],
  ['TOPIC', onTopic],
]);

export const processBufferedMessage = (ctx: IrcContext, message: ParsedIrcRawMessage): void => {
  bufferedHandlers.get(message.command)?.(new IrcContext(message, ctx.eventLine));
};

export const handlers: IrcHandlers = {
  BATCH: onBatch,
};
