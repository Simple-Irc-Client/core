import i18next from '@/app/i18n';
import { parseNick } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { showReply } from '@/network/irc/kernel/replies';
import { setTopic, setTopicSetBy } from '@features/channels/store/channels';
import { getUserModes } from '@features/settings/store/settings';
import { MessageCategory } from '@shared/types';

const RPL_NOTOPIC = '331';
const RPL_TOPIC = '332';
const RPL_TOPICWHOTIME = '333';

// @account=Merovingian;msgid=33x8Q9DP1OpJVeJe3S7usg;time=2023-03-23T00:04:18.011Z :Merovingian!~pirc@cloak:Merovingian TOPIC #sic :Test 1
export const onTopic = (ctx: IrcContext): void => {
  const channel = ctx.line.shift();

  const topic = ctx.trailing();

  if (channel === undefined) {
    ctx.logParseError(onTopic, 'channel');
    return;
  }

  const { nick } = parseNick(ctx.sender, getUserModes());

  showReply(ctx, {
    message: i18next.t(`kernel.topic`, { nick, topic }),
    target: channel,
    category: MessageCategory.info,
  });

  setTopic(channel, topic);
};

// :server 331 mynick #channel :No topic is set
export const onRaw331 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();

  if (channel === undefined) {
    ctx.logParseError(onRaw331, 'channel');
    return;
  }

  setTopic(channel, '');
};

// :chmurka.pirc.pl 332 SIC-test #sic :Prace nad Simple Irc Client trwają
// :irc01-black.librairc.net 332 mero-test #chat :\u00034Welcome to #chat chatroom at http://librairc.net ~ for rules check https://goo.gl/Ksv9gr ~ If you need help type /join #help
export const onRaw332 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();
  const topic = ctx.trailing();

  if (channel === undefined) {
    ctx.logParseError(onRaw332, 'channel');
    return;
  }

  setTopic(channel, topic);
};

// :chmurka.pirc.pl 333 SIC-test #sic Merovingian 1552692216
export const onRaw333 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();
  const setBy = ctx.line.shift();
  const setTime = Number(ctx.line.shift() ?? '0');

  if (channel === undefined) {
    ctx.logParseError(onRaw333, 'channel');
    return;
  }
  if (setBy === undefined) {
    ctx.logParseError(onRaw333, 'setBy');
    return;
  }

  setTopicSetBy(channel, setBy, setTime);
};

export const handlers: IrcHandlers = {
  TOPIC: onTopic,
  [RPL_NOTOPIC]: onRaw331,
  [RPL_TOPIC]: onRaw332,
  [RPL_TOPICWHOTIME]: onRaw333,
};
