import { calculateMaxPermission, parseNick } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { getUserModes } from '@features/settings/store/settings';
import { bufferNamesUsers, flushNamesUsers, type NamesUser } from '@features/users/store/users';

const RPL_NAMREPLY = '353';
const RPL_ENDOFNAMES = '366';

// :irc01-black.librairc.net 353 mero-test = #chat :ircbot!ircbot@ircbot.botop.librairc.net Freak!Freak@LibraIRC-ug4.vta.mvnbg3.IP WatchDog!WatchDog@Watchdog.botop.librairc.net !~@iBan!iBan@iBan.botop.librairc.net !iBot!iBot@iBot.botop.librairc.net chip_x!chip@LibraIRC-i5e.6cr.4lkbg1.IP
// :chmurka.pirc.pl 353 SIC-test = #sic :SIC-test!~SIC-test@D6D788C7.623ED634.C8132F93.IP @Noop!~Noop@AB43659:6EA4AE53:B58B785A:IP
// :chmurka.pirc.pl 353 sic-test = #Religie :aleksa7!~aleksa7@vhost:kohana.aleksia +Alisha!~user@397FF66D:D8E4ABEE:5838DA6D:IP +ProrokCodzienny!~ProrokCod@AB43659:6EA4AE53:B58B785A:IP &@Pomocnik!pomocny@bot:kanalowy.pomocnik krejzus!krejzus@ukryty-13F27FB6.brb.dj Cienisty!Cienisty@cloak:Cienisty
export const onRaw353 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  ctx.line.shift(); // flags
  const channel = ctx.line.shift();

  if (channel === undefined) {
    ctx.logParseError(onRaw353, 'channel');
    return;
  }

  const serverPrefixes = getUserModes();
  const entries: NamesUser[] = [];

  for (let user of ctx.line) {
    if (user.startsWith(':')) {
      user = user.substring(1);
    }

    const { flags, nick, ident, hostname } = parseNick(user, serverPrefixes);

    entries.push({ nick, ident, hostname, flags, maxPermission: calculateMaxPermission(flags, serverPrefixes) });
  }

  bufferNamesUsers(channel, entries);
};

// :bzyk.pirc.pl 366 SIC-test #sic :End of /NAMES list.
export const onRaw366 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick
  const channel = ctx.line.shift();

  if (channel === undefined) {
    ctx.logParseError(onRaw366, 'channel');
    return;
  }

  flushNamesUsers(channel);
};

export const handlers: IrcHandlers = {
  [RPL_NAMREPLY]: onRaw353,
  [RPL_ENDOFNAMES]: onRaw366,
};
