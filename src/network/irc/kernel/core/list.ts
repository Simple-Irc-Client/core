import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { ircSendAlisListRequest } from '@/network/irc/network';
import { showNumericReply, translateKnownText } from '@/network/irc/kernel/unhandled';
import {
  getAlisMode,
  getListDeprecated,
  setAddChannelToList,
  setAlisMode,
  setChannelListClear,
  setChannelListFinished,
  setChannelListRefused,
  useChannelListStore,
} from '@features/channels/store/channelList';

const RPL_TRYAGAIN = '263';
const RPL_LISTSTART = '321';
const RPL_LIST = '322';
const RPL_ENDOFLIST = '323';

// :insomnia.pirc.pl 321 dsfdsfdsfsdfdsfsdfaas Channel :Users  Name
export const onRaw321 = (): void => {
  setChannelListClear();
};

// :insomnia.pirc.pl 322 dsfdsfdsfsdfdsfsdfaas #Base 1 :[+nt]
// :netsplit.pirc.pl 322 sic-test * 1 :
// :netsplit.pirc.pl 322 sic-test #+Kosciol+ 1 :[+nt]
export const onRaw322 = (ctx: IrcContext): void => {
  if (getAlisMode()) { return; }

  ctx.line.shift(); // my nick

  const name = ctx.line.shift() ?? '';
  const users = Number(ctx.line.shift() ?? '0');
  const topic = ctx.trailing();

  setAddChannelToList(name, users, topic);
};

// :insomnia.pirc.pl 323 dsfdsfdsfsdfdsfsdfaas :End of /LIST
export const onRaw323 = (): void => {
  if (getAlisMode()) { return; }

  // Deprecated LIST with too few results: fall back to Alis
  if (getListDeprecated() && useChannelListStore.getState().channels.length < 10) {
    setChannelListClear();
    setAlisMode(true);
    ircSendAlisListRequest();
    return;
  }

  setChannelListFinished(true);
};

// :uranium.libera.chat 263 mynick LIST :This command could not be completed because it has been used recently, and is rate-limited.
// Answers whichever command was rate-limited: only a refused LIST ends the wait for the channel list
export const onRaw263 = (ctx: IrcContext): void => {
  const [, command] = ctx.line;
  if (command?.toUpperCase() === 'LIST') {
    setChannelListRefused(translateKnownText(ctx.command, ctx.paramsAndText().text));
  }
  showNumericReply(ctx);
};

export const handlers: IrcHandlers = {
  [RPL_TRYAGAIN]: onRaw263,
  [RPL_LISTSTART]: onRaw321,
  [RPL_LIST]: onRaw322,
  [RPL_ENDOFLIST]: onRaw323,
};
