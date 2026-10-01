import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { ircSendAlisListRequest } from '@/network/irc/network';
import { getAlisMode, getListDeprecated, setAddChannelToList, setAlisMode, setChannelListClear, setChannelListFinished, useChannelListStore } from '@features/channels/store/channelList';

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

export const handlers: IrcHandlers = {
  [RPL_LISTSTART]: onRaw321,
  [RPL_LIST]: onRaw322,
  [RPL_ENDOFLIST]: onRaw323,
};
