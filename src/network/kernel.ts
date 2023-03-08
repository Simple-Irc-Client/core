/* eslint-disable @typescript-eslint/no-unused-vars */
import { useChannelsStore, type ChannelsStore } from '../store/channels';
import { useSettingsStore, type SettingsStore } from '../store/settings';
import { useUsersStore, type UsersStore } from '../store/users';
import { ChannelCategory, MessageCategory, type UserTypingStatus } from '../types';
import { createMaxMode, parseIrcRawMessage, parseNick, parseUserModes } from './helpers';
import { ircRequestMetadata, ircSendList, ircSendNamesXProto } from './network';
import i18next from '../i18n';
import { MessageColor } from '../config/theme';
import { type ChannelListContextProps } from '../providers/ChannelListContext';

export interface IrcEvent {
  type: string;
  line?: string;
}

const STATUS_CHANNEL = 'Status';
const DEBUG_CHANNEL = 'Debug';

export const kernel = (event: IrcEvent, channelListContext: ChannelListContextProps): void => {
  const settingsStore = useSettingsStore.getState();
  const channelsStore = useChannelsStore.getState();
  const usersStore = useUsersStore.getState();

  switch (event.type) {
    case 'connected':
      handleConnected(settingsStore, channelsStore);
      break;
    case 'close':
      handleDisconnected(channelsStore);
      break;
    case 'raw':
      if (event?.line !== undefined) {
        handleRaw(settingsStore, channelsStore, channelListContext, usersStore, event.line);
      }
      break;
  }
};

const handleConnected = (settingsStore: SettingsStore, channelsStore: ChannelsStore): void => {
  settingsStore.setIsConnected(true);
  settingsStore.setConnectedTime(Math.floor(Date.now() / 1000));

  if (channelsStore.getChannel(DEBUG_CHANNEL) === undefined) {
    channelsStore.setAddChannel(DEBUG_CHANNEL, ChannelCategory.debug);
    channelsStore.setAddChannel(STATUS_CHANNEL, ChannelCategory.status);
    settingsStore.setCurrentChannelName(STATUS_CHANNEL, ChannelCategory.status);
  }

  for (const channel of channelsStore.openChannels) {
    channelsStore.setAddMessage(channel.name, {
      message: i18next.t('kernel.connected'),
      target: channel.name,
      time: new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  }

  ircSendList();
};

const handleDisconnected = (channelsStore: ChannelsStore): void => {
  for (const channel of channelsStore.openChannels) {
    channelsStore.setAddMessage(channel.name, {
      message: i18next.t('kernel.disconnected'),
      target: channel.name,
      time: new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  }
};

const handleRaw = (settingsStore: SettingsStore, channelsStore: ChannelsStore, channelListContext: ChannelListContextProps, usersStore: UsersStore, event: string): void => {
  const { tags, sender, command, line } = parseIrcRawMessage(event);

  channelsStore.setAddMessage(DEBUG_CHANNEL, {
    message: `<- ${event.trim()}`,
    target: DEBUG_CHANNEL,
    time: new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.serverFrom,
  });

  switch (command) {
    case '001':
      onRaw001(channelsStore, tags, line);
      break;
    case '002':
      onRaw002(channelsStore, tags, line);
      break;
    case '003':
      onRaw003(channelsStore, tags, line);
      break;
    case '004':
      onRaw004();
      break;
    case '005':
      onRaw005(settingsStore, line);
      break;
    case '251':
      onRaw251(channelsStore, tags, line);
      break;
    case '252':
      onRaw252(channelsStore, tags, line);
      break;
    case '253':
      onRaw253(channelsStore, tags, line);
      break;
    case '254':
      onRaw254(channelsStore, tags, line);
      break;
    case '255':
      onRaw255(channelsStore, tags, line);
      break;
    case '265':
      onRaw265(channelsStore, tags, line);
      break;
    case '266':
      onRaw266(channelsStore, tags, line);
      break;
    case '321':
      onRaw321(channelListContext);
      break;
    case '322':
      onRaw322(channelListContext, line);
      break;
    case '323':
      onRaw323(channelListContext);
      break;
    case '332':
      onRaw332(channelsStore, line);
      break;
    case '333':
      onRaw333(channelsStore, line);
      break;
    case '353':
      onRaw353(settingsStore, usersStore, line);
      break;
    case '366':
      onRaw366();
      break;
    case '372':
      onRaw372(channelsStore, tags, line);
      break;
    case '375':
      onRaw375(channelsStore, tags, line);
      break;
    case '376':
      onRaw376(channelsStore, tags, line);
      break;
    case '761':
      onRaw761(usersStore, line);
      break;
    case '762':
      onRaw762();
      break;
    case '766':
      onRaw766();
      break;
    case 'NOTICE':
      onNotice(settingsStore, channelsStore, tags, sender, command, line);
      break;
    case 'NICK':
      onNick(settingsStore, channelsStore, usersStore, tags, sender, command, line);
      break;
    case 'JOIN':
      onJoin(settingsStore, channelsStore, usersStore, tags, sender, command, line);
      break;
    case 'PART':
      onPart(settingsStore, channelsStore, usersStore, tags, sender, command, line);
      break;
    case 'PRIVMSG':
      onPrivMsg(settingsStore, channelsStore, usersStore, tags, sender, command, line);
      break;
    case 'TAGMSG':
      onTagMsg(settingsStore, channelsStore, usersStore, tags, sender, command, line);
      break;
    default:
      console.log(`unknown irc event: ${JSON.stringify(event)}`);
      break;
  }

  // TODO
  // insomnia.pirc.pl 432 * Merovingian :Nickname is unavailable: Being held for registered user
  // ERROR :Closing Link: [1.1.1.1] (Registration Timeout)
  // :netsplit.pirc.pl BATCH +0G9Zyu0qr7Jem5SdPufanF chathistory #sic
  // :netsplit.pirc.pl BATCH -0G9Zyu0qr7Jem5SdPufanF
  // @draft/bot;msgid=TAwD3gzM6wZJulwi2hI0Ki;time=2023-03-04T19:13:32.450Z :Pomocnik!pomocny@bot:kanalowy.pomocnik MODE #Religie +h Merovingian

  // Ban => 'b',
  // Exception => 'e',
  // Limit => 'l',
  // InviteOnly => 'i',
  // InviteException => 'I',
  // Key => 'k',
  // Moderated => 'm',
  // RegisteredOnly => 'r',
  // Secret => 's',
  // ProtectedTopic => 't',
  // NoExternalMessages => 'n',
  // Founder => 'q',
  // Admin => 'a',
  // Oper => 'o',
  // Halfop => 'h',
  // Voice => 'v',
};

// :netsplit.pirc.pl 001 SIC-test :Welcome to the pirc.pl IRC Network SIC-test!~SIC-test@1.1.1.1
const onRaw001 = (channelsStore: ChannelsStore, tags: Record<string, string>, line: string[]): void => {
  const nick = line.shift();

  const message = line.join(' ').substring(1);

  channelsStore.setAddMessage(STATUS_CHANNEL, {
    message,
    target: STATUS_CHANNEL,
    time: tags?.time ?? new Date().toISOString(),
    category: MessageCategory.motd,
    color: MessageColor.info,
  });
};

// :netsplit.pirc.pl 002 SIC-test :Your host is netsplit.pirc.pl, running version UnrealIRCd-6.0.3
const onRaw002 = (channelsStore: ChannelsStore, tags: Record<string, string>, line: string[]): void => {
  const nick = line.shift();

  const message = line.join(' ').substring(1);

  channelsStore.setAddMessage(STATUS_CHANNEL, {
    message,
    target: STATUS_CHANNEL,
    time: tags?.time ?? new Date().toISOString(),
    category: MessageCategory.motd,
    color: MessageColor.info,
  });
};

// :netsplit.pirc.pl 003 SIC-test :This server was created Sun May 8 2022 at 13:49:18 UTC
const onRaw003 = (channelsStore: ChannelsStore, tags: Record<string, string>, line: string[]): void => {
  const nick = line.shift();

  const message = line.join(' ').substring(1);

  channelsStore.setAddMessage(STATUS_CHANNEL, {
    message,
    target: STATUS_CHANNEL,
    time: tags?.time ?? new Date().toISOString(),
    category: MessageCategory.motd,
    color: MessageColor.info,
  });
};

// :netsplit.pirc.pl 004 SIC-test netsplit.pirc.pl UnrealIRCd-6.0.3 diknopqrstwxzBDFGHINRSTWZ beIacdfhiklmnopqrstvzBCDGHKLMNOPQRSTVZ
const onRaw004 = (): void => {
  //
};

// :netsplit.pirc.pl 005 SIC-test AWAYLEN=307 BOT=B CASEMAPPING=ascii CHANLIMIT=#:30 CHANMODES=beI,fkL,lH,cdimnprstzBCDGKMNOPQRSTVZ CHANNELLEN=32 CHANTYPES=# CHATHISTORY=50 CLIENTTAGDENY=*,-draft/typing,-typing,-draft/reply DEAF=d ELIST=MNUCT EXCEPTS :are supported by this server
// :netsplit.pirc.pl 005 SIC-test EXTBAN=~,acfjmnpqrtCGIOST EXTJWT=1 INVEX KICKLEN=307 KNOCK MAP MAXCHANNELS=30 MAXLIST=b:200,e:200,I:200 MAXNICKLEN=30 METADATA=10 MINNICKLEN=0 MODES=12 :are supported by this server
// :netsplit.pirc.pl 005 SIC-test MONITOR=128 NAMELEN=50 NAMESX NETWORK=pirc.pl NICKLEN=30 PREFIX=(qaohv)~&@%+ QUITLEN=307 SAFELIST SILENCE=15 STATUSMSG=~&@%+ TARGMAX=DCCALLOW:,ISON:,JOIN:,KICK:4,KILL:,LIST:,NAMES:1,NOTICE:1,PART:,PRIVMSG:4,SAJOIN:,SAPART:,TAGMSG:1,USERHOST:,USERIP:,WATCH:,WHOIS:1,WHOWAS:1 TOPICLEN=360 :are supported by this server
// :netsplit.pirc.pl 005 SIC-test UHNAMES USERIP WALLCHOPS WATCH=128 WATCHOPTS=A WHOX :are supported by this server
const onRaw005 = (settingsStore: SettingsStore, line: string[]): void => {
  for (let singleLine of line) {
    singleLine = singleLine.replace(':are supported by this server', '');
    const parameters = singleLine.split(' ');
    for (const parameter of parameters) {
      if (parameter.includes('=')) {
        const [key, value] = parameter.split('=');
        switch (key) {
          // TODO
          // case 'CHANTYPES':
          // settingsStore.setChannelTypes(value);
          // break;
          case 'PREFIX':
            settingsStore.setUserModes(parseUserModes(value));
            break;
        }
      }

      if (parameter === 'NAMESX') {
        settingsStore.setNamesXProtoEnabled(true);
        ircSendNamesXProto();
      }
    }
  }
};

// :saturn.pirc.pl 251 SIC-test :There are 158 users and 113 invisible on 10 servers
const onRaw251 = (channelsStore: ChannelsStore, tags: Record<string, string>, line: string[]): void => {
  const nick = line.shift();

  const message = line.join(' ').substring(1);

  channelsStore.setAddMessage(STATUS_CHANNEL, {
    message,
    target: STATUS_CHANNEL,
    time: tags?.time ?? new Date().toISOString(),
    category: MessageCategory.motd,
    color: MessageColor.info,
  });
};

// :saturn.pirc.pl 252 SIC-test 27 :operator(s) online
const onRaw252 = (channelsStore: ChannelsStore, tags: Record<string, string>, line: string[]): void => {
  const nick = line.shift();

  const message = line.join(' ').substring(1);

  channelsStore.setAddMessage(STATUS_CHANNEL, {
    message,
    target: STATUS_CHANNEL,
    time: tags?.time ?? new Date().toISOString(),
    category: MessageCategory.motd,
    color: MessageColor.info,
  });
};

// :saturn.pirc.pl 253 SIC-test -14 :unknown connection(s)
const onRaw253 = (channelsStore: ChannelsStore, tags: Record<string, string>, line: string[]): void => {
  const nick = line.shift();

  const message = line.join(' ').substring(1);

  channelsStore.setAddMessage(STATUS_CHANNEL, {
    message,
    target: STATUS_CHANNEL,
    time: tags?.time ?? new Date().toISOString(),
    category: MessageCategory.motd,
    color: MessageColor.info,
  });
};

// :saturn.pirc.pl 254 SIC-test 185 :channels formed
const onRaw254 = (channelsStore: ChannelsStore, tags: Record<string, string>, line: string[]): void => {
  const nick = line.shift();

  const message = line.join(' ').substring(1);

  channelsStore.setAddMessage(STATUS_CHANNEL, {
    message,
    target: STATUS_CHANNEL,
    time: tags?.time ?? new Date().toISOString(),
    category: MessageCategory.motd,
    color: MessageColor.info,
  });
};

// :saturn.pirc.pl 255 SIC-test :I have 42 clients and 0 servers
const onRaw255 = (channelsStore: ChannelsStore, tags: Record<string, string>, line: string[]): void => {
  const nick = line.shift();

  const message = line.join(' ').substring(1);

  channelsStore.setAddMessage(STATUS_CHANNEL, {
    message,
    target: STATUS_CHANNEL,
    time: tags?.time ?? new Date().toISOString(),
    category: MessageCategory.motd,
    color: MessageColor.info,
  });
};

// :saturn.pirc.pl 265 SIC-test 42 62 :Current local users 42, max 62
const onRaw265 = (channelsStore: ChannelsStore, tags: Record<string, string>, line: string[]): void => {
  const nick = line.shift();

  const message = line.join(' ').substring(1);

  channelsStore.setAddMessage(STATUS_CHANNEL, {
    message,
    target: STATUS_CHANNEL,
    time: tags?.time ?? new Date().toISOString(),
    category: MessageCategory.motd,
    color: MessageColor.info,
  });
};

// :saturn.pirc.pl 266 SIC-test 271 1721 :Current global users 271, max 1721
const onRaw266 = (channelsStore: ChannelsStore, tags: Record<string, string>, line: string[]): void => {
  const nick = line.shift();

  const message = line.join(' ').substring(1);

  channelsStore.setAddMessage(STATUS_CHANNEL, {
    message,
    target: STATUS_CHANNEL,
    time: tags?.time ?? new Date().toISOString(),
    category: MessageCategory.motd,
    color: MessageColor.info,
  });
};

// :insomnia.pirc.pl 321 dsfdsfdsfsdfdsfsdfaas Channel :Users  Name
const onRaw321 = (channelListContext: ChannelListContextProps): void => {
  channelListContext.clear();
  channelListContext.setFinished(false);
};

// :insomnia.pirc.pl 322 dsfdsfdsfsdfdsfsdfaas #Base 1 :[+nt]
const onRaw322 = (channelListContext: ChannelListContextProps, line: string[]): void => {
  const sender = line.shift();

  const name = line.shift() ?? '';
  const users = Number(line.shift() ?? '0');
  const topic = line.join(' ')?.substring(1);

  channelListContext.add({ name, users, topic });
};

// :insomnia.pirc.pl 323 dsfdsfdsfsdfdsfsdfaas :End of /LIST
const onRaw323 = (channelListContext: ChannelListContextProps): void => {
  channelListContext.setFinished(true);
};

// :chmurka.pirc.pl 332 SIC-test #sic :Prace nad Simple Irc Client trwają
const onRaw332 = (channelsStore: ChannelsStore, line: string[]): void => {
  const nick = line.shift();
  const channel = line.shift();
  const topic = line.join(' ')?.substring(1);

  if (channel === undefined) {
    console.warn('RAW 332 - warning - cannot read channel');
    return;
  }

  channelsStore.setTopic(channel, topic);
};

// :chmurka.pirc.pl 333 SIC-test #sic Merovingian 1552692216
const onRaw333 = (channelsStore: ChannelsStore, line: string[]): void => {
  const currentUser = line.shift();
  const channel = line.shift();
  const setBy = line.shift();
  const setTime = Number(line.shift() ?? '0');

  if (channel === undefined || setBy === undefined) {
    console.warn('RAW 333 - warning - cannot read channel or setBy');
    return;
  }

  channelsStore.setTopicSetBy(channel, setBy, setTime);
};

// :chmurka.pirc.pl 353 SIC-test = #sic :SIC-test!~SIC-test@D6D788C7.623ED634.C8132F93.IP @Noop!~Noop@AB43659:6EA4AE53:B58B785A:IP
const onRaw353 = (settingsStore: SettingsStore, usersStore: UsersStore, line: string[]): void => {
  const currentUser = line.shift();
  const flags = line.shift();
  const channel = line.shift();

  if (channel === undefined) {
    console.warn('RAW 353 - warning - cannot read channel');
    return;
  }

  for (let user of line) {
    if (user.startsWith(':')) {
      user = user.substring(1);
    }

    const serverUserPrefixes = settingsStore.userModes;
    const { modes, nick, ident, hostname } = parseNick(user, settingsStore.userModes);

    if (usersStore.getHasUser(nick)) {
      usersStore.setJoinUser(nick, channel);
    } else {
      usersStore.setAddUser({
        nick,
        ident,
        hostname,
        modes,
        maxMode: createMaxMode(modes, serverUserPrefixes),
        channels: [channel],
      });

      ircRequestMetadata(nick);
    }
  }
};

// :bzyk.pirc.pl 366 SIC-test #sic :End of /NAMES list.
const onRaw366 = (): void => {
  //
};

// :saturn.pirc.pl 372 SIC-test :- 2/6/2022 11:27
const onRaw372 = (channelsStore: ChannelsStore, tags: Record<string, string>, line: string[]): void => {
  const nick = line.shift();

  const message = line.join(' ').substring(1);

  channelsStore.setAddMessage(STATUS_CHANNEL, {
    message,
    target: STATUS_CHANNEL,
    time: tags?.time ?? new Date().toISOString(),
    category: MessageCategory.motd,
    color: MessageColor.info,
  });
};

// :saturn.pirc.pl 375 SIC-test :- saturn.pirc.pl Message of the Day -
const onRaw375 = (channelsStore: ChannelsStore, tags: Record<string, string>, line: string[]): void => {
  const nick = line.shift();

  const message = line.join(' ').substring(1);

  channelsStore.setAddMessage(STATUS_CHANNEL, {
    message,
    target: STATUS_CHANNEL,
    time: tags?.time ?? new Date().toISOString(),
    category: MessageCategory.motd,
    color: MessageColor.info,
  });
};

// :saturn.pirc.pl 376 SIC-test :End of /MOTD command.
const onRaw376 = (channelsStore: ChannelsStore, tags: Record<string, string>, line: string[]): void => {
  const nick = line.shift();

  const message = line.join(' ').substring(1);

  channelsStore.setAddMessage(STATUS_CHANNEL, {
    message,
    target: STATUS_CHANNEL,
    time: tags?.time ?? new Date().toISOString(),
    category: MessageCategory.motd,
    color: MessageColor.info,
  });
};

// :insomnia.pirc.pl 761 SIC-test Merovingian Avatar * :https://www.gravatar.com/avatar/8fadd198f40929e83421dd81e36f5637.jpg
const onRaw761 = (usersStore: UsersStore, line: string[]): void => {
  const currentUser = line.shift();
  const nick = line.shift();
  const item = line.shift()?.toLowerCase();
  const flags = line.shift();
  const value = line.shift()?.substring(1);

  if (nick === undefined) {
    console.warn('RAW 761 - warning - cannot read nick');
    return;
  }

  if (item === 'avatar' && value !== undefined) {
    usersStore.setUserAvatar(nick, value);
  }
  if (item === 'color' && value !== undefined) {
    usersStore.setUserColor(nick, value);
  }
};

// :chmurka.pirc.pl 762 SIC-test :end of metadata
const onRaw762 = (): void => {
  //
};

// :insomnia.pirc.pl 766 SIC-test SIC-test Avatar :no matching key
const onRaw766 = (): void => {
  //
};

// @draft/bot;msgid=mcOQVkbTRyuCcC0Rso27IB;time=2023-02-22T00:20:59.308Z :Pomocnik!pomocny@bot:kanalowy.pomocnik NOTICE mero-test :[#religie] Dla trolli są inne kanały...
// :insomnia.pirc.pl NOTICE SIC-test :You have to be connected for at least 20 seconds before being able to /LIST, please ignore the fake output above
// :netsplit.pirc.pl NOTICE * :*** No ident response; username prefixed with ~
// @draft/bot;msgid=hjeGCPN39ksrHai7Rs5gda;time=2023-02-04T22:48:46.472Z :NickServ!NickServ@serwisy.pirc.pl NOTICE ghfghfghfghfghfgh :Twój nick nie jest zarejestrowany. Aby dowiedzieć się, jak go zarejestrować i po co, zajrzyj na https://pirc.pl/serwisy/nickserv/
const onNotice = (settingsStore: SettingsStore, channelsStore: ChannelsStore, tags: Record<string, string>, sender: string, command: string, line: string[]): void => {
  const passwordRequired = /^(This nickname is registered and protected|Ten nick jest zarejestrowany i chroniony).*/;

  const list = /.*You have to be connected for at least (\d+) seconds before being able to \/LIST, please ignore the fake output above.*/;

  const target = line.shift();

  if (target === undefined) {
    console.warn('RAW NOTICE - warning - cannot read target');
    return;
  }

  let message = line.join(' ');
  if (message.at(0) === ':') {
    message = message.substring(1);
  }

  const { nick } = parseNick(sender, settingsStore.userModes);

  const newMessage = {
    message,
    nick: nick.length !== 0 ? nick : undefined,
    target,
    time: tags?.time ?? new Date().toISOString(),
    category: MessageCategory.notice,
    color: MessageColor.notice,
  };

  channelsStore.setAddMessage(STATUS_CHANNEL, newMessage);
  if (settingsStore.currentChannelName !== STATUS_CHANNEL) {
    channelsStore.setAddMessage(settingsStore.currentChannelName, newMessage);
  }

  if (nick === 'NickServ' && target === settingsStore.nick && passwordRequired.test(message)) {
    settingsStore.setIsPasswordRequired(true);
    settingsStore.setCreatorStep('password');
  }

  if (target === settingsStore.nick && list.test(message)) {
    const seconds = list.exec(message)?.[1];
    if (seconds !== undefined && settingsStore.connectedTime !== 0) {
      const currentTime = Math.floor(Date.now() / 1000);
      const loggedTime = currentTime - settingsStore.connectedTime;
      const remaining = loggedTime > Number(seconds) ? 0 : Number(seconds) - loggedTime;
      settingsStore.setListRequestRemainingSeconds(remaining);
    }
  }
};

// @msgid=ls4nEYgZI42LXbsrfkcwcc;time=2023-02-12T14:20:53.072Z :Merovingian NICK :Niezident36707
const onNick = (settingsStore: SettingsStore, channelsStore: ChannelsStore, usersStore: UsersStore, tags: Record<string, string>, sender: string, command: string, line: string[]): void => {
  const newNick = line.shift()?.substring(1);

  if (newNick === undefined) {
    console.warn('RAW NICK - warning - cannot read new nick');
    return;
  }

  if (sender === settingsStore.nick) {
    channelsStore.setAddMessage(settingsStore.currentChannelName, {
      message: i18next.t('kernel.nick').replace('{{from}}', sender).replace('{{to}}', newNick),
      target: settingsStore.currentChannelName,
      time: tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });

    settingsStore.setNick(newNick);
    usersStore.setRenameUser(sender, newNick);
  } else {
    usersStore.setRenameUser(sender, newNick);
  }
};

// @msgid=oXhSn3eP0x5LlSJTX2SxJj-NXV6407yG5qKZnAWemhyGQ;time=2023-02-11T20:42:11.830Z :SIC-test!~SIC-test@D6D788C7.623ED634.C8132F93.IP JOIN #sic * :Simple Irc Client user
const onJoin = (settingsStore: SettingsStore, channelsStore: ChannelsStore, usersStore: UsersStore, tags: Record<string, string>, sender: string, command: string, line: string[]): void => {
  const channel = line.shift();
  const { nick, ident, hostname } = parseNick(sender, settingsStore.userModes);

  if (channel === undefined) {
    console.warn('RAW JOIN - warning - cannot read channel');
    return;
  }

  if (nick === settingsStore.nick) {
    channelsStore.setAddChannel(channel, ChannelCategory.channel);
    settingsStore.setCurrentChannelName(channel, ChannelCategory.channel);
  } else {
    channelsStore.setAddMessage(settingsStore.currentChannelName, {
      message: i18next.t('kernel.join').replace('{{nick}}', nick),
      nick: undefined,
      target: channel,
      time: tags?.time ?? new Date().toISOString(),
      category: MessageCategory.join,
      color: MessageColor.join,
    });

    if (channelsStore.getChannel(channel) === undefined) {
      channelsStore.setAddChannel(channel, ChannelCategory.channel);
    }

    if (usersStore.getHasUser(nick)) {
      usersStore.setJoinUser(nick, channel);
    } else {
      usersStore.setAddUser({
        nick,
        ident,
        hostname,
        modes: [],
        maxMode: 0,
        channels: [channel],
      });

      ircRequestMetadata(nick);
    }
  }
};

// @account=Merovingian;msgid=hXPXorNkRXTwVOTU1RbpXN-0D/dV2/Monv6zuHQw/QAGw;time=2023-02-12T22:44:07.583Z :Merovingian!~pirc@cloak:Merovingian PART #sic :Opuścił kanał
const onPart = (settingsStore: SettingsStore, channelsStore: ChannelsStore, usersStore: UsersStore, tags: Record<string, string>, sender: string, command: string, line: string[]): void => {
  const channel = line.shift();
  const reason = line.join(' ').substring(1) ?? '';

  if (channel === undefined) {
    console.warn('RAW PART - warning - cannot read channel');
    return;
  }

  const { nick } = parseNick(sender, settingsStore.userModes);
  if (nick === settingsStore.nick) {
    const usersFromChannel = usersStore.getUsersFromChannelSortedByAZ(channel);
    for (const userFromChannel of usersFromChannel) {
      usersStore.setRemoveUser(userFromChannel.nick, channel);
    }
    channelsStore.setRemoveChannel(channel);

    // TODO select new channel
    settingsStore.setCurrentChannelName(STATUS_CHANNEL, ChannelCategory.status);
  } else {
    channelsStore.setAddMessage(settingsStore.currentChannelName, {
      message: i18next
        .t('kernel.part')
        .replace('{{nick}}', nick)
        .replace('{{reason}}', reason.length !== 0 ? `(${reason})` : ''),
      target: channel,
      time: tags?.time ?? new Date().toISOString(),
      category: MessageCategory.part,
      color: MessageColor.part,
    });

    usersStore.setRemoveUser(nick, channel);
  }
};

// @batch=UEaMMV4PXL3ymLItBEAhBO;msgid=498xEffzvc3SBMJsRPQ5Iq;time=2023-02-12T02:06:12.210Z :SIC-test2!~mero@D6D788C7.623ED634.C8132F93.IP PRIVMSG #sic :test 1
// @msgid=HPS1IK0ruo8t691kVDRtFl;time=2023-02-12T02:11:26.770Z :SIC-test2!~mero@D6D788C7.623ED634.C8132F93.IP PRIVMSG #sic :test 4
const onPrivMsg = (settingsStore: SettingsStore, channelsStore: ChannelsStore, usersStore: UsersStore, tags: Record<string, string>, sender: string, command: string, line: string[]): void => {
  const serverUserModes = settingsStore.userModes;

  const target = line.shift();
  const message = line.join(' ').substring(1);
  const { nick } = parseNick(sender, serverUserModes);

  if (target === undefined) {
    console.warn('RAW PRIVMSG - warning - cannot read target');
    return;
  }

  if (target === settingsStore.nick) {
    // TODO priv
  } else {
    if (target !== settingsStore.currentChannelName) {
      channelsStore.setIncreaseUnreadMessages(target);
    }

    if (target === settingsStore.currentChannelName) {
      channelsStore.setTyping(target, nick, 'done');
    }

    const user = usersStore.getUser(nick);

    channelsStore.setAddMessage(target, {
      message,
      nick: user ?? nick,
      target,
      time: tags?.time ?? new Date().toISOString(),
      category: MessageCategory.default,
      color: MessageColor.default,
    });
  }
};

// @+draft/typing=active;+typing=active;account=kato_starszy;msgid=tsfqUigTlAhCbQYkVpty5s;time=2023-03-04T19:16:23.158Z :kato_starszy!~pirc@ukryty-FF796E25.net130.okay.pl TAGMSG #Religie\r\n
const onTagMsg = (settingsStore: SettingsStore, channelsStore: ChannelsStore, usersStore: UsersStore, tags: Record<string, string>, sender: string, command: string, line: string[]): void => {
  const serverUserModes = settingsStore.userModes;

  const channel = line.shift();

  if (channel === undefined) {
    console.warn('RAW TAGMSG - warning - cannot read channel');
    return;
  }

  const { nick } = parseNick(sender, serverUserModes);

  const status = tags?.['+typing'];
  if (status !== undefined) {
    channelsStore.setTyping(channel, nick, status as UserTypingStatus);
  }
};
