import { type IrcHandler, type IrcHandlers } from '@/network/irc/kernel/context';
import { handlers as connection } from '@/network/irc/kernel/connection';
import { handlers as coreChannelInvite } from '@/network/irc/kernel/core/channel/invite';
import { handlers as coreChannelJoin } from '@/network/irc/kernel/core/channel/join';
import { handlers as coreChannelKick } from '@/network/irc/kernel/core/channel/kick';
import { handlers as coreChannelNames } from '@/network/irc/kernel/core/channel/names';
import { handlers as coreChannelTopic } from '@/network/irc/kernel/core/channel/topic';
import { handlers as coreCommands } from '@/network/irc/kernel/core/commands';
import { handlers as coreInfoAdmin } from '@/network/irc/kernel/core/info/admin';
import { handlers as coreInfoHelp } from '@/network/irc/kernel/core/info/help';
import { handlers as coreInfoInfo } from '@/network/irc/kernel/core/info/info';
import { handlers as coreInfoIsupport } from '@/network/irc/kernel/core/info/isupport';
import { handlers as coreInfoLinks } from '@/network/irc/kernel/core/info/links';
import { handlers as coreInfoMotd } from '@/network/irc/kernel/core/info/motd';
import { handlers as coreInfoTime } from '@/network/irc/kernel/core/info/time';
import { handlers as coreInfoVersion } from '@/network/irc/kernel/core/info/version';
import { handlers as coreList } from '@/network/irc/kernel/core/list';
import { handlers as coreLusers } from '@/network/irc/kernel/core/lusers';
import { handlers as coreMessage } from '@/network/irc/kernel/core/message';
import { handlers as coreMode } from '@/network/irc/kernel/core/mode';
import { handlers as coreOperKill } from '@/network/irc/kernel/core/oper/kill';
import { handlers as coreOperOper } from '@/network/irc/kernel/core/oper/oper';
import { handlers as coreOperRehash } from '@/network/irc/kernel/core/oper/rehash';
import { handlers as coreStats } from '@/network/irc/kernel/core/stats';
import { handlers as coreUserAway } from '@/network/irc/kernel/core/user/away';
import { handlers as coreUserNick } from '@/network/irc/kernel/core/user/nick';
import { handlers as coreUserPart } from '@/network/irc/kernel/core/user/part';
import { handlers as coreUserPing } from '@/network/irc/kernel/core/user/ping';
import { handlers as coreUserQuit } from '@/network/irc/kernel/core/user/quit';
import { handlers as coreUserRegister } from '@/network/irc/kernel/core/user/register';
import { handlers as coreWho } from '@/network/irc/kernel/core/who';
import { handlers as coreWhois } from '@/network/irc/kernel/core/whois';
import { handlers as coreWhowas } from '@/network/irc/kernel/core/whowas';
import { handlers as extensionsQuietlist } from '@/network/irc/kernel/extensions/quietlist';
import { handlers as extensionsWatch } from '@/network/irc/kernel/extensions/watch';
import { handlers as ircv3Account } from '@/network/irc/kernel/ircv3/account';
import { handlers as ircv3Batch } from '@/network/irc/kernel/ircv3/batch';
import { handlers as ircv3Cap } from '@/network/irc/kernel/ircv3/cap';
import { handlers as ircv3Chghost } from '@/network/irc/kernel/ircv3/chghost';
import { handlers as ircv3Metadata } from '@/network/irc/kernel/ircv3/metadata';
import { handlers as ircv3Monitor } from '@/network/irc/kernel/ircv3/monitor';
import { handlers as ircv3Sasl } from '@/network/irc/kernel/ircv3/sasl';
import { handlers as ircv3Setname } from '@/network/irc/kernel/ircv3/setname';
import { handlers as ircv3Typing } from '@/network/irc/kernel/ircv3/typing';

/** A Map, so commands like `constructor` never resolve to Object.prototype members. */
export const mergeHandlers = (...modules: IrcHandlers[]): Map<string, IrcHandler> => {
  const merged = new Map<string, IrcHandler>();
  for (const module of modules) {
    for (const [command, handler] of Object.entries(module)) {
      if (merged.has(command)) {
        throw new Error(`Duplicate IRC handler for ${command}`);
      }
      merged.set(command, handler);
    }
  }
  return merged;
};

export const ircHandlers = mergeHandlers(
  connection,
  coreChannelInvite,
  coreChannelJoin,
  coreChannelKick,
  coreChannelNames,
  coreChannelTopic,
  coreCommands,
  coreInfoAdmin,
  coreInfoHelp,
  coreInfoInfo,
  coreInfoIsupport,
  coreInfoLinks,
  coreInfoMotd,
  coreInfoTime,
  coreInfoVersion,
  coreList,
  coreLusers,
  coreMessage,
  coreMode,
  coreOperKill,
  coreOperOper,
  coreOperRehash,
  coreStats,
  coreUserAway,
  coreUserNick,
  coreUserPart,
  coreUserPing,
  coreUserQuit,
  coreUserRegister,
  coreWho,
  coreWhois,
  coreWhowas,
  extensionsQuietlist,
  extensionsWatch,
  ircv3Account,
  ircv3Batch,
  ircv3Cap,
  ircv3Chghost,
  ircv3Metadata,
  ircv3Monitor,
  ircv3Sasl,
  ircv3Setname,
  ircv3Typing,
);
