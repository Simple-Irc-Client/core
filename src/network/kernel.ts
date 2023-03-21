/* eslint-disable @typescript-eslint/no-unused-vars */
import { existChannel, setAddChannel, setAddMessage, setAddMessageToAllChannels, setIncreaseUnreadMessages, setRemoveChannel, setTopic, setTopicSetBy, setTyping } from '../store/channels';
import {
  getConnectedTime,
  getCurrentChannelName,
  getCurrentNick,
  getIsCreatorCompleted,
  getUserModes,
  setChannelTypes,
  setConnectedTime,
  setCreatorStep,
  setCurrentChannelName,
  setIsConnected,
  setIsPasswordRequired,
  setListRequestRemainingSeconds,
  setNamesXProtoEnabled,
  setNick,
  setUserModes,
} from '../store/settings';
import { getHasUser, getUser, getUsersFromChannelSortedByAZ, setAddUser, setJoinUser, setRemoveUser, setRenameUser, setUserAvatar, setUserColor } from '../store/users';
import { ChannelCategory, MessageCategory, type UserTypingStatus } from '../types';
import { createMaxMode, parseIrcRawMessage, parseNick, parseUserModes } from './helpers';
import { ircRequestMetadata, ircSendList, ircSendNamesXProto } from './network';
import i18next from '../i18n';
import { MessageColor } from '../config/theme';
import { defaultChannelType } from '../config/config';
import { v4 as uuidv4 } from 'uuid';
import { setAddChannelToList, setChannelListClear, setChannelListFinished } from '../store/channelList';

export interface IrcEvent {
  type: string;
  line?: string;
}

const STATUS_CHANNEL = 'Status';
const DEBUG_CHANNEL = 'Debug';

export class Kernel {
  private tags: Record<string, string>;
  private sender: string;
  private command: string;
  private line: string[];

  constructor() {
    this.tags = {};
    this.sender = '';
    this.command = '';
    this.line = [];
  }

  handle(event: IrcEvent): void {
    switch (event.type) {
      case 'connect':
        this.handleConnect();
        break;
      case 'connected':
        this.handleConnected();
        break;
      case 'close':
        this.handleDisconnected();
        break;
      case 'raw':
        if (event?.line !== undefined) {
          this.handleRaw(event.line);
        }
        break;
    }
  }

  private readonly handleConnect = (): void => {
    setAddChannel(DEBUG_CHANNEL, ChannelCategory.debug);
    setAddChannel(STATUS_CHANNEL, ChannelCategory.status);
    setCurrentChannelName(STATUS_CHANNEL, ChannelCategory.status);
  };

  private readonly handleConnected = (): void => {
    setIsConnected(true);
    setConnectedTime(Math.floor(Date.now() / 1000));

    setAddMessageToAllChannels({
      id: uuidv4(),
      message: i18next.t('kernel.connected'),
      time: new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });

    ircSendList();
  };

  private readonly handleDisconnected = (): void => {
    setIsConnected(false);

    setAddMessageToAllChannels({
      id: uuidv4(),
      message: i18next.t('kernel.disconnected'),
      time: new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  private readonly handleRaw = (event: string): void => {
    const { tags, sender, command, line } = parseIrcRawMessage(event);
    this.tags = tags;
    this.sender = sender;
    this.command = command;
    this.line = line;

    setAddMessage({
      id: uuidv4(),
      message: `<- ${event.trim()}`,
      target: DEBUG_CHANNEL,
      time: new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.serverFrom,
    });

    switch (command) {
      case '001':
        this.onRaw001();
        break;
      case '002':
        this.onRaw002();
        break;
      case '003':
        this.onRaw003();
        break;
      case '004':
        this.onRaw004();
        break;
      case '005':
        this.onRaw005();
        break;
      case '251':
        this.onRaw251();
        break;
      case '252':
        this.onRaw252();
        break;
      case '253':
        this.onRaw253();
        break;
      case '254':
        this.onRaw254();
        break;
      case '255':
        this.onRaw255();
        break;
      case '265':
        this.onRaw265();
        break;
      case '266':
        this.onRaw266();
        break;
      case '321':
        this.onRaw321();
        break;
      case '322':
        this.onRaw322();
        break;
      case '323':
        this.onRaw323();
        break;
      case '332':
        this.onRaw332();
        break;
      case '333':
        this.onRaw333();
        break;
      case '353':
        this.onRaw353();
        break;
      case '366':
        this.onRaw366();
        break;
      case '372':
        this.onRaw372();
        break;
      case '375':
        this.onRaw375();
        break;
      case '376':
        this.onRaw376();
        break;
      case '396':
        this.onRaw396();
        break;
      case '761':
        this.onRaw761();
        break;
      case '762':
        this.onRaw762();
        break;
      case '766':
        this.onRaw766();
        break;
      case 'ERROR':
        this.onError();
        break;
      case 'PONG':
        this.onPong();
        break;
      case 'BATCH':
        this.onBatch();
        break;
      case 'NOTICE':
        this.onNotice();
        break;
      case 'NICK':
        this.onNick();
        break;
      case 'JOIN':
        this.onJoin();
        break;
      case 'PART':
        this.onPart();
        break;
      case 'KICK':
        this.onKick();
        break;
      case 'QUIT':
        this.onQuit();
        break;
      case 'MODE':
        this.onMode();
        break;
      case 'PRIVMSG':
        this.onPrivMsg();
        break;
      case 'TAGMSG':
        this.onTagMsg();
        break;
      // case 'CAP':
      // this.onCap();
      // break;
      default:
        console.log(`unknown irc event: ${JSON.stringify(event)}`);
        break;
    }

    // TODO
    // insomnia.pirc.pl 432 * Merovingian :Nickname is unavailable: Being held for registered user
    // :irc01-black.librairc.net 432 * ioiijhjkkljkljlkj :Erroneous Nickname
  };

  // :netsplit.pirc.pl 001 SIC-test :Welcome to the pirc.pl IRC Network SIC-test!~SIC-test@1.1.1.1
  private readonly onRaw001 = (): void => {
    const nick = this.line.shift();

    const message = this.line.join(' ').substring(1);

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :netsplit.pirc.pl 002 SIC-test :Your host is netsplit.pirc.pl, running version UnrealIRCd-6.0.3
  private readonly onRaw002 = (): void => {
    const nick = this.line.shift();

    const message = this.line.join(' ').substring(1);

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :netsplit.pirc.pl 003 SIC-test :This server was created Sun May 8 2022 at 13:49:18 UTC
  private readonly onRaw003 = (): void => {
    const nick = this.line.shift();

    const message = this.line.join(' ').substring(1);

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :netsplit.pirc.pl 004 SIC-test netsplit.pirc.pl UnrealIRCd-6.0.3 diknopqrstwxzBDFGHINRSTWZ beIacdfhiklmnopqrstvzBCDGHKLMNOPQRSTVZ
  private readonly onRaw004 = (): void => {
    const nick = this.line.shift();

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: this.line.join(' '),
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :netsplit.pirc.pl 005 SIC-test AWAYLEN=307 BOT=B CASEMAPPING=ascii CHANLIMIT=#:30 CHANMODES=beI,fkL,lH,cdimnprstzBCDGKMNOPQRSTVZ CHANNELLEN=32 CHANTYPES=# CHATHISTORY=50 CLIENTTAGDENY=*,-draft/typing,-typing,-draft/reply DEAF=d ELIST=MNUCT EXCEPTS :are supported by this server
  // :netsplit.pirc.pl 005 SIC-test EXTBAN=~,acfjmnpqrtCGIOST EXTJWT=1 INVEX KICKLEN=307 KNOCK MAP MAXCHANNELS=30 MAXLIST=b:200,e:200,I:200 MAXNICKLEN=30 METADATA=10 MINNICKLEN=0 MODES=12 :are supported by this server
  // :netsplit.pirc.pl 005 SIC-test MONITOR=128 NAMELEN=50 NAMESX NETWORK=pirc.pl NICKLEN=30 PREFIX=(qaohv)~&@%+ QUITLEN=307 SAFELIST SILENCE=15 STATUSMSG=~&@%+ TARGMAX=DCCALLOW:,ISON:,JOIN:,KICK:4,KILL:,LIST:,NAMES:1,NOTICE:1,PART:,PRIVMSG:4,SAJOIN:,SAPART:,TAGMSG:1,USERHOST:,USERIP:,WATCH:,WHOIS:1,WHOWAS:1 TOPICLEN=360 :are supported by this server
  // :netsplit.pirc.pl 005 SIC-test UHNAMES USERIP WALLCHOPS WATCH=128 WATCHOPTS=A WHOX :are supported by this server
  private readonly onRaw005 = (): void => {
    const nick = this.line.shift();

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: this.line.join(' '),
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });

    for (let singleLine of this.line) {
      singleLine = singleLine.replace(':are supported by this server', '');
      const parameters = singleLine.split(' ');
      for (const parameter of parameters) {
        if (parameter.includes('=')) {
          const [key, value] = parameter.split('=');
          switch (key) {
            case 'CHANTYPES':
              setChannelTypes((value ?? defaultChannelType).split(''));
              break;
            case 'PREFIX':
              setUserModes(parseUserModes(value));
              break;
          }
        }

        if (parameter === 'NAMESX') {
          setNamesXProtoEnabled(true);
          ircSendNamesXProto();
        }
      }
    }
  };

  // :saturn.pirc.pl 251 SIC-test :There are 158 users and 113 invisible on 10 servers
  private readonly onRaw251 = (): void => {
    const nick = this.line.shift();

    const message = this.line.join(' ').substring(1);

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :saturn.pirc.pl 252 SIC-test 27 :operator(s) online
  private readonly onRaw252 = (): void => {
    const nick = this.line.shift();

    const message = this.line.join(' ');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :saturn.pirc.pl 253 SIC-test -14 :unknown connection(s)
  private readonly onRaw253 = (): void => {
    const nick = this.line.shift();

    const message = this.line.join(' ');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :saturn.pirc.pl 254 SIC-test 185 :channels formed
  private readonly onRaw254 = (): void => {
    const nick = this.line.shift();

    const message = this.line.join(' ');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :saturn.pirc.pl 255 SIC-test :I have 42 clients and 0 servers
  private readonly onRaw255 = (): void => {
    const nick = this.line.shift();

    const message = this.line.join(' ').substring(1);

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :saturn.pirc.pl 265 SIC-test 42 62 :Current local users 42, max 62
  private readonly onRaw265 = (): void => {
    const nick = this.line.shift();
    const local = this.line.shift();
    const max = this.line.shift();

    const message = this.line.join(' ').substring(1);

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :saturn.pirc.pl 266 SIC-test 271 1721 :Current global users 271, max 1721
  private readonly onRaw266 = (): void => {
    const nick = this.line.shift();
    const global = this.line.shift();
    const max = this.line.shift();

    const message = this.line.join(' ').substring(1);

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :insomnia.pirc.pl 321 dsfdsfdsfsdfdsfsdfaas Channel :Users  Name
  private readonly onRaw321 = (): void => {
    setChannelListClear();
  };

  // :insomnia.pirc.pl 322 dsfdsfdsfsdfdsfsdfaas #Base 1 :[+nt]
  // :netsplit.pirc.pl 322 sic-test * 1 :
  // :netsplit.pirc.pl 322 sic-test #+Kosciol+ 1 :[+nt]
  private readonly onRaw322 = (): void => {
    const sender = this.line.shift();

    const name = this.line.shift() ?? '';
    const users = Number(this.line.shift() ?? '0');
    const topic = this.line.join(' ')?.substring(1);

    setAddChannelToList(name, users, topic);
  };

  // :insomnia.pirc.pl 323 dsfdsfdsfsdfdsfsdfaas :End of /LIST
  private readonly onRaw323 = (): void => {
    setChannelListFinished(true);
  };

  // :chmurka.pirc.pl 332 SIC-test #sic :Prace nad Simple Irc Client trwają
  private readonly onRaw332 = (): void => {
    const nick = this.line.shift();
    const channel = this.line.shift();
    const topic = this.line.join(' ')?.substring(1);

    if (channel === undefined) {
      console.warn('RAW 332 - warning - cannot read channel');
      return;
    }

    setTopic(channel, topic);
  };

  // :chmurka.pirc.pl 333 SIC-test #sic Merovingian 1552692216
  private readonly onRaw333 = (): void => {
    const currentUser = this.line.shift();
    const channel = this.line.shift();
    const setBy = this.line.shift();
    const setTime = Number(this.line.shift() ?? '0');

    if (channel === undefined || setBy === undefined) {
      console.warn('RAW 333 - warning - cannot read channel or setBy');
      return;
    }

    setTopicSetBy(channel, setBy, setTime);
  };

  // :chmurka.pirc.pl 353 SIC-test = #sic :SIC-test!~SIC-test@D6D788C7.623ED634.C8132F93.IP @Noop!~Noop@AB43659:6EA4AE53:B58B785A:IP
  // :chmurka.pirc.pl 353 sic-test = #Religie :aleksa7!~aleksa7@vhost:kohana.aleksia +Alisha!~user@397FF66D:D8E4ABEE:5838DA6D:IP +ProrokCodzienny!~ProrokCod@AB43659:6EA4AE53:B58B785A:IP &@Pomocnik!pomocny@bot:kanalowy.pomocnik krejzus!krejzus@ukryty-13F27FB6.brb.dj Cienisty!Cienisty@cloak:Cienisty
  private readonly onRaw353 = (): void => {
    const currentUser = this.line.shift();
    const flags = this.line.shift();
    const channel = this.line.shift();

    if (channel === undefined) {
      console.warn('RAW 353 - warning - cannot read channel');
      return;
    }

    for (let user of this.line) {
      if (user.startsWith(':')) {
        user = user.substring(1);
      }

      const serverUserPrefixes = getUserModes();
      const { modes, nick, ident, hostname } = parseNick(user, serverUserPrefixes);

      if (getHasUser(nick)) {
        setJoinUser(nick, channel);
      } else {
        setAddUser({
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
  private readonly onRaw366 = (): void => {
    //
  };

  // :saturn.pirc.pl 372 SIC-test :- 2/6/2022 11:27
  private readonly onRaw372 = (): void => {
    const nick = this.line.shift();

    const message = this.line.join(' ').substring(1);

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.motd,
      color: MessageColor.info,
    });
  };

  // :saturn.pirc.pl 375 SIC-test :- saturn.pirc.pl Message of the Day -
  private readonly onRaw375 = (): void => {
    const nick = this.line.shift();

    const message = this.line.join(' ').substring(1);

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.motd,
      color: MessageColor.info,
    });
  };

  // :saturn.pirc.pl 376 SIC-test :End of /MOTD command.
  private readonly onRaw376 = (): void => {
    const nick = this.line.shift();

    const message = this.line.join(' ').substring(1);

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.motd,
      color: MessageColor.info,
    });
  };

  // :chmurka.pirc.pl 396 sic-test A.A.A.IP :is now your displayed host
  private readonly onRaw396 = (): void => {
    const nick = this.line.shift();

    const message = this.line.join(' ');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :insomnia.pirc.pl 761 SIC-test Merovingian Avatar * :https://www.gravatar.com/avatar/8fadd198f40929e83421dd81e36f5637.jpg
  private readonly onRaw761 = (): void => {
    const currentUser = this.line.shift();
    const nick = this.line.shift();
    const item = this.line.shift()?.toLowerCase();
    const flags = this.line.shift();
    const value = this.line.shift()?.substring(1);

    if (nick === undefined) {
      console.warn('RAW 761 - warning - cannot read nick');
      return;
    }

    if (item === 'avatar' && value !== undefined) {
      setUserAvatar(nick, value);
    }
    if (item === 'color' && value !== undefined) {
      setUserColor(nick, value);
    }
  };

  // :chmurka.pirc.pl 762 SIC-test :end of metadata
  private readonly onRaw762 = (): void => {
    //
  };

  // :insomnia.pirc.pl 766 SIC-test SIC-test Avatar :no matching key
  private readonly onRaw766 = (): void => {
    //
  };

  // ERROR :Closing Link: [1.1.1.1] (Registration Timeout)
  private readonly onError = (): void => {
    const message = this.line.join(' ').substring(1);

    if (getIsCreatorCompleted()) {
      setAddMessageToAllChannels({
        id: this.tags?.msgid ?? uuidv4(),
        message,
        time: new Date().toISOString(),
        category: MessageCategory.error,
        color: MessageColor.error,
      });
    } else {
      // TODO
      // setProgress({ value: 0, label: i18next.t('creator.loading.error').replace('{{message}}', message) });
    }
  };

  // @msgid=MIikH9lopbKqOQpz8ADjfP;time=2023-03-20T23:07:21.701Z :chmurka.pirc.pl PONG chmurka.pirc.pl :1679353641686
  private readonly onPong = (): void => {
    //
  };

  // :netsplit.pirc.pl BATCH +0G9Zyu0qr7Jem5SdPufanF chathistory #sic
  // :netsplit.pirc.pl BATCH -0G9Zyu0qr7Jem5SdPufanF
  private readonly onBatch = (): void => {
    //
  };

  // @draft/bot;msgid=mcOQVkbTRyuCcC0Rso27IB;time=2023-02-22T00:20:59.308Z :Pomocnik!pomocny@bot:kanalowy.pomocnik NOTICE mero-test :[#religie] Dla trolli są inne kanały...
  // :insomnia.pirc.pl NOTICE SIC-test :You have to be connected for at least 20 seconds before being able to /LIST, please ignore the fake output above
  // :netsplit.pirc.pl NOTICE * :*** No ident response; username prefixed with ~
  // @draft/bot;msgid=hjeGCPN39ksrHai7Rs5gda;time=2023-02-04T22:48:46.472Z :NickServ!NickServ@serwisy.pirc.pl NOTICE SIC-test :Twój nick nie jest zarejestrowany. Aby dowiedzieć się, jak go zarejestrować i po co, zajrzyj na https://pirc.pl/serwisy/nickserv/
  private readonly onNotice = (): void => {
    const currentChannelName = getCurrentChannelName();

    const passwordRequired = /^(This nickname is registered and protected|Ten nick jest zarejestrowany i chroniony).*/;
    const list = /.*You have to be connected for at least (\d+) seconds before being able to \/LIST.*/;

    const target = this.line.shift();

    if (target === undefined) {
      console.warn('RAW NOTICE - warning - cannot read target');
      return;
    }

    const message = this.line.join(' ').substring(1);

    const { nick } = parseNick(this.sender, getUserModes());

    if (nick === 'NickServ' && target === getCurrentNick() && passwordRequired.test(message)) {
      setIsPasswordRequired(true);
      setCreatorStep('password');
    }

    if (list.test(message) && target === getCurrentNick() && !getIsCreatorCompleted()) {
      const seconds = list.exec(message)?.[1];
      const connectedTime = getConnectedTime();
      if (seconds !== undefined && connectedTime !== 0) {
        const currentTime = Math.floor(Date.now() / 1000);
        const loggedTime = currentTime - connectedTime;
        const remaining = loggedTime > Number(seconds) ? 0 : Number(seconds) - loggedTime;
        setListRequestRemainingSeconds(remaining);
      }
      return;
    }

    const newMessage = {
      message,
      nick: nick.length !== 0 ? nick : undefined,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.notice,
      color: MessageColor.notice,
    };

    setAddMessage({ ...newMessage, target: STATUS_CHANNEL, id: uuidv4() });
    if (currentChannelName !== STATUS_CHANNEL) {
      setAddMessage({ ...newMessage, target: currentChannelName, id: this.tags?.msgid ?? uuidv4() });
    }
  };

  // @msgid=ls4nEYgZI42LXbsrfkcwcc;time=2023-02-12T14:20:53.072Z :Merovingian NICK :Niezident36707
  private readonly onNick = (): void => {
    const currentChannelName = getCurrentChannelName();
    const newNick = this.line.shift()?.substring(1);

    if (newNick === undefined) {
      console.warn('RAW NICK - warning - cannot read new nick');
      return;
    }

    if (this.sender === getCurrentNick()) {
      setAddMessage({
        id: this.tags?.msgid ?? uuidv4(),
        message: i18next.t('kernel.nick').replace('{{from}}', this.sender).replace('{{to}}', newNick),
        target: currentChannelName,
        time: this.tags?.time ?? new Date().toISOString(),
        category: MessageCategory.info,
        color: MessageColor.info,
      });

      setNick(newNick);
      setRenameUser(this.sender, newNick);
    } else {
      setRenameUser(this.sender, newNick);
    }
  };

  // @msgid=oXhSn3eP0x5LlSJTX2SxJj-NXV6407yG5qKZnAWemhyGQ;time=2023-02-11T20:42:11.830Z :SIC-test!~SIC-test@D6D788C7.623ED634.C8132F93.IP JOIN #sic * :Simple Irc Client user
  private readonly onJoin = (): void => {
    const channel = this.line.shift();
    const { nick, ident, hostname } = parseNick(this.sender, getUserModes());

    if (channel === undefined) {
      console.warn('RAW JOIN - warning - cannot read channel');
      return;
    }

    if (nick === getCurrentNick()) {
      setAddChannel(channel, ChannelCategory.channel);
      setCurrentChannelName(channel, ChannelCategory.channel);
    } else {
      setAddMessage({
        id: this.tags?.msgid ?? uuidv4(),
        message: i18next.t('kernel.join').replace('{{nick}}', nick),
        target: channel,
        time: this.tags?.time ?? new Date().toISOString(),
        category: MessageCategory.join,
        color: MessageColor.join,
      });

      setAddChannel(channel, ChannelCategory.channel);

      if (getHasUser(nick)) {
        setJoinUser(nick, channel);
      } else {
        setAddUser({
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
  private readonly onPart = (): void => {
    const channel = this.line.shift();
    const reason = this.line.join(' ').substring(1) ?? '';

    if (channel === undefined) {
      console.warn('RAW PART - warning - cannot read channel');
      return;
    }

    const { nick } = parseNick(this.sender, getUserModes());
    if (nick === getCurrentNick()) {
      const usersFromChannel = getUsersFromChannelSortedByAZ(channel);
      for (const userFromChannel of usersFromChannel) {
        setRemoveUser(userFromChannel.nick, channel);
      }
      setRemoveChannel(channel);

      // TODO select new channel
      setCurrentChannelName(STATUS_CHANNEL, ChannelCategory.status);
    } else {
      setAddMessage({
        id: this.tags?.msgid ?? uuidv4(),
        message: i18next
          .t('kernel.part')
          .replace('{{nick}}', nick)
          .replace('{{reason}}', reason.length !== 0 ? `(${reason})` : ''),
        target: channel,
        time: this.tags?.time ?? new Date().toISOString(),
        category: MessageCategory.part,
        color: MessageColor.part,
      });

      setRemoveUser(nick, channel);
    }
  };

  // @account=ratler__;msgid=qDtfbJQ2Ym74HmVRslOgeZ-mLABGCzcOme4EdMIqCME+A;time=2023-03-20T21:23:29.512Z :ratler__!~pirc@vhost:ratler.ratler KICK #Religie sic-test :ratler__
  private readonly onKick = (): void => {
    // TODO
  };

  // @msgid=aGJTRBjAMOMRB6Ky2ucXbV-Gved4HyF6QNSHYfzOX1jOA;time=2023-03-11T00:52:21.568Z :mero!~mero@D6D788C7.623ED634.C8132F93.IP QUIT :Quit: Leaving
  private readonly onQuit = (): void => {
    // TODO
  };

  // @draft/bot;msgid=TAwD3gzM6wZJulwi2hI0Ki;time=2023-03-04T19:13:32.450Z :Pomocnik!pomocny@bot:kanalowy.pomocnik MODE #Religie +h Merovingian
  // @account=PEPSISEXIBOMBA;msgid=c97PqlwAZZ8m2aRhCPMl8O;time=2023-03-19T20:35:06.649Z :PEPSISEXIBOMBA!~yooz@cloak:PEPSISEXIBOMBA MODE #Religie +b *!*@ukryty-D5702E9C.dip0.t-ipconnect.de
  // @draft/bot;msgid=g3x5HMBRj88mm32ndwtaUp;time=2023-03-19T21:08:35.308Z :Pomocnik!pomocny@bot:kanalowy.pomocnik MODE #Religie +v rupert__

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
  private readonly onMode = (): void => {
    // TODO
  };

  // @batch=UEaMMV4PXL3ymLItBEAhBO;msgid=498xEffzvc3SBMJsRPQ5Iq;time=2023-02-12T02:06:12.210Z :SIC-test2!~mero@D6D788C7.623ED634.C8132F93.IP PRIVMSG #sic :test 1
  // @msgid=HPS1IK0ruo8t691kVDRtFl;time=2023-02-12T02:11:26.770Z :SIC-test2!~mero@D6D788C7.623ED634.C8132F93.IP PRIVMSG #sic :test 4
  private readonly onPrivMsg = (): void => {
    const serverUserModes = getUserModes();
    const currentChannelName = getCurrentChannelName();

    const target = this.line.shift();
    const message = this.line.join(' ').substring(1);
    const { nick } = parseNick(this.sender, serverUserModes);

    if (target === undefined) {
      console.warn('RAW PRIVMSG - warning - cannot read target');
      return;
    }

    const isPrivMessage = target === getCurrentNick();
    const messageTarget = isPrivMessage ? nick : target;

    if (!existChannel(messageTarget)) {
      setAddChannel(messageTarget, isPrivMessage ? ChannelCategory.priv : ChannelCategory.channel);
    }

    if (messageTarget !== currentChannelName) {
      setIncreaseUnreadMessages(messageTarget);
    }

    if (messageTarget === currentChannelName) {
      setTyping(messageTarget, nick, 'done');
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      nick: getUser(nick) ?? nick,
      target: messageTarget,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.default,
      color: MessageColor.default,
    });
  };

  // @+draft/typing=active;+typing=active;account=kato_starszy;msgid=tsfqUigTlAhCbQYkVpty5s;time=2023-03-04T19:16:23.158Z :kato_starszy!~pirc@ukryty-FF796E25.net130.okay.pl TAGMSG #Religie\r\n
  private readonly onTagMsg = (): void => {
    const serverUserModes = getUserModes();

    const channel = this.line.shift();

    if (channel === undefined) {
      console.warn('RAW TAGMSG - warning - cannot read channel');
      return;
    }

    const { nick } = parseNick(this.sender, serverUserModes);

    const status = this.tags?.['+typing'];
    if (status !== undefined) {
      setTyping(channel, nick, status as UserTypingStatus);
    }
  };

  // :chmurka.pirc.pl CAP * LS * :sts=port=6697,duration=300 unrealircd.org/link-security=2 unrealircd.org/plaintext-policy=user=allow,oper=deny,server=deny unrealircd.org/history-storage=memory draft/metadata-notify-2 draft/metadata=maxsub=10 pirc.pl/killme away-notify invite-notify extended-join userhost-in-names multi-prefix cap-notify sasl=EXTERNAL,PLAIN setname tls chghost account-notify message-tags batch server-time account-tag echo-message labeled-response draft/chathistory draft/extended-monitor
  // :jowisz.pirc.pl CAP * LS :unrealircd.org/json-log
  private readonly onCap = (): void => {
    const user = this.line.shift();
    const response = this.line.shift(); // LS, ACK

    const caps: Record<string, string> = {};

    const capList = this.line.shift()?.split(' ') ?? [];
    for (const cap of capList) {
      if (!cap.includes('=')) {
        caps[cap] = '';
      } else {
        const key = cap.substring(0, cap.indexOf('='));
        const value = cap.substring(cap.indexOf('=') + 1);
        caps[key] = value;
      }
    }
  };
}
