import { addToBatch, BATCH_TYPES, type BatchState, endBatch, getBatch, startBatch } from '@/network/irc/batch';
import { onHistoryBatch, pendingHistoryAnchor } from '@/network/irc/chatHistory';
import { takeLabel } from '@/network/irc/labels';
import { combineMultiline } from '@/network/irc/multiline';
import { type HistoryReplay, IrcContext, type IrcHandler, type IrcHandlers } from '@/network/irc/kernel/context';
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
import { onBouncer } from '@/network/irc/kernel/ircv3/bouncer';
import { onChghost } from '@/network/irc/kernel/ircv3/chghost';
import { onMetadata } from '@/network/irc/kernel/ircv3/metadata';
import { applyReadMarker } from '@/network/irc/kernel/ircv3/readmarker';
import { onSetname } from '@/network/irc/kernel/ircv3/setname';
import { setAddHistoryPage } from '@features/channels/store/channels';
import { onTagMsg } from '@/network/irc/kernel/ircv3/tagmsg';
import { type ParsedIrcRawMessage } from '@shared/types';

// :netsplit.pirc.pl BATCH +0G9Zyu0qr7Jem5SdPufanF chathistory #sic
// :netsplit.pirc.pl BATCH -0G9Zyu0qr7Jem5SdPufanF
// BATCH +reference type [params...]
// BATCH -reference
// The last parameter may come as a trailing one: BATCH +reference type :target, BATCH :-reference
export const onBatch = (ctx: IrcContext): void => {
  const { params: middle, text } = ctx.paramsAndText();
  const [reference, type = '', ...params] = ctx.line.some((token) => token.startsWith(':')) ? [...middle, text] : middle;

  if (!reference) { return; }

  if (reference.startsWith('+')) {
    const id = reference.substring(1);

    const label = ctx.tags.label;

    startBatch(id, type, params, label !== undefined ? takeLabel(label) : undefined, ctx.tags);
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
    case BATCH_TYPES.MULTILINE:
      processMultilineBatch(ctx, batch);
      break;
    default:
      // netjoin, netsplit, soju.im/bouncer-networks and unknown types are replayed as-is
      for (const message of batch.messages) {
        processBufferedMessage(ctx, message);
      }
  }
};

export const processChatHistoryBatch = (ctx: IrcContext, batch: BatchState): void => {
  const target = batch.params[0];
  if (!target) { return; }

  const history: HistoryReplay = { target, page: [] };
  for (const message of batch.messages) {
    if (historyCommands.has(message.command)) {
      processBufferedMessage(ctx, message, history);
    }
  }
  setAddHistoryPage(history.page, pendingHistoryAnchor(target));
  applyReadMarker(target);

  // A chathistory batch is in the server's order: the first message is the oldest
  const first = batch.messages.find((message) => !Number.isNaN(Date.parse(message.tags.time ?? '')));
  const oldest = first === undefined ? undefined : { time: Date.parse(first.tags.time ?? ''), msgid: first.tags.msgid };
  onHistoryBatch(target, batch.messages.length, oldest);
};

/** Delivered as one message where its lines would have gone: into the batch it is nested in, or as just arrived */
export const processMultilineBatch = (ctx: IrcContext, batch: BatchState): void => {
  const combined = combineMultiline(batch);
  const parent = batch.parent === undefined ? undefined : getBatch(batch.parent);
  for (const message of combined === undefined ? batch.messages : [combined]) {
    if (parent !== undefined && parent.type !== BATCH_TYPES.LABELED_RESPONSE) {
      addToBatch(parent.id, message);
      continue;
    }
    const messageCtx = new IrcContext(message, ctx.eventLine);
    messageCtx.request = batch.request ?? parent?.request;
    bufferedHandlers.get(message.command)?.(messageCtx);
  }
};

// What history shows; other events would apply stale state. TAGMSG brings reactions, its typing is ignored
const historyCommands = new Set(['JOIN', 'KICK', 'MODE', 'NICK', 'NOTICE', 'PART', 'PRIVMSG', 'QUIT', 'TAGMSG', 'TOPIC']);

// Commands replayed from a finished batch; numerics inside batches are not replayed
const bufferedHandlers = new Map<string, IrcHandler>([
  ['ACCOUNT', onAccount],
  ['AWAY', onAway],
  ['BOUNCER', onBouncer],
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

/** `history` collects what a replayed chathistory message shows */
export const processBufferedMessage = (ctx: IrcContext, message: ParsedIrcRawMessage, history?: HistoryReplay): void => {
  bufferedHandlers.get(message.command)?.(new IrcContext(message, ctx.eventLine, { history }));
};

export const handlers: IrcHandlers = {
  BATCH: onBatch,
};
