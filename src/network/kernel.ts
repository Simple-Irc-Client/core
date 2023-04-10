/* eslint-disable @typescript-eslint/no-unused-vars */
import { existChannel, isChannel, setAddChannel, setAddMessage, setAddMessageToAllChannels, setIncreaseUnreadMessages, setRemoveChannel, setTopic, setTopicSetBy, setTyping } from '../store/channels';
import {
  getChannelModes,
  getConnectedTime,
  getCurrentChannelName,
  getCurrentNick,
  getIsCreatorCompleted,
  getUserModes,
  isSupportedOption,
  setChannelModes,
  setChannelTypes,
  setConnectedTime,
  setCreatorProgress,
  setCreatorStep,
  setCurrentChannelName,
  setIsConnected,
  setIsConnecting,
  setIsPasswordRequired,
  setListRequestRemainingSeconds,
  setNick,
  setSupportedOption,
  setUserModes,
} from '../store/settings';
import { getHasUser, getUser, getUserChannels, setAddUser, setJoinUser, setQuitUser, setRemoveUser, setRenameUser, setUpdateUserFlag, setUserAvatar, setUserColor } from '../store/users';
import { ChannelCategory, MessageCategory, type UserTypingStatus } from '../types';
import { channelModeType, calculateMaxPermission, parseChannelModes, parseIrcRawMessage, parseNick, parseUserModes } from './helpers';
import { ircRequestMetadata, ircSendList, ircSendNamesXProto, ircSendRawMessage } from './network';
import i18next from '../i18n';
import { MessageColor } from '../config/theme';
import { defaultChannelTypes, defaultMaxPermission } from '../config/config';
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

  private eventLine: string;

  constructor() {
    this.tags = {};
    this.sender = '';
    this.command = '';
    this.line = [];

    this.eventLine = '';
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  assert = (func: Function, variable: string): Error => {
    return new Error(`Kernel error - cannot parse ${variable} at ${func.name}`);
  };

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
      default:
        console.log(`unhandled kernel event: ${event.type} ${event?.line ?? ''}`);
    }
  }

  private readonly handleConnect = (): void => {
    setAddChannel(DEBUG_CHANNEL, ChannelCategory.debug);
    setAddChannel(STATUS_CHANNEL, ChannelCategory.status);
    setCurrentChannelName(STATUS_CHANNEL, ChannelCategory.status);
  };

  private readonly handleConnected = (): void => {
    setIsConnecting(false);
    setIsConnected(true);
    setConnectedTime(Math.floor(Date.now() / 1000));

    setAddMessageToAllChannels({
      id: uuidv4(),
      message: i18next.t('kernel.connected'),
      time: new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  private readonly handleDisconnected = (): void => {
    setIsConnecting(false);
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
    this.eventLine = event?.trim();

    setAddMessage({
      id: uuidv4(),
      message: `>> ${this.eventLine}`,
      target: DEBUG_CHANNEL,
      time: new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.serverFrom,
    });

    switch (command) {
      case 'AWAY':
        this.onAway();
        break;
      case 'BATCH':
        this.onBatch();
        break;
      case 'CAP':
        this.onCap();
        break;
      case 'ERROR':
        this.onError();
        break;
      case 'INVITE':
        this.onInvite();
        break;
      case 'JOIN':
        this.onJoin();
        break;
      case 'KICK':
        this.onKick();
        break;
      case 'KILL':
        this.onKill();
        break;
      case 'METADATA':
        this.onMetadata();
        break;
      case 'MODE':
        this.onMode();
        break;
      case 'NICK':
        this.onNick();
        break;
      case 'NOTICE':
        this.onNotice();
        break;
      case 'PART':
        this.onPart();
        break;
      case 'PING':
        this.onPing();
        break;
      case 'PONG':
        this.onPong();
        break;
      case 'PRIVMSG':
        this.onPrivMsg();
        break;
      case 'QUIT':
        this.onQuit();
        break;
      case 'TAGMSG':
        this.onTagMsg();
        break;
      case 'TOPIC':
        this.onTopic();
        break;

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
      case '432':
        this.onRaw432();
        break;
      case '442':
        this.onRaw442();
        break;
      case '474':
        this.onRaw474();
        break;
      case '477':
        this.onRaw477();
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

      default:
        console.log(`unknown irc event: ${JSON.stringify(event)}`);
        break;
    }

    // TODO unknown raw:
    // :chmurka.pirc.pl 448 sic-test Global :Cannot join channel: Channel name must start with a hash mark (#)

    // :insomnia.pirc.pl 354 mero 152 #Religie ~pirc ukryty-88E7A1BA.adsl.inetia.pl * JAKNEK Hs 0 :Użytkownik bramki PIRC.pl "JAKNEK"

    // whois:
    // :chmurka.pirc.pl 311 sic-test Noop ~Noop ukryty-29093CCD.compute-1.amazonaws.com * :*
    // :chmurka.pirc.pl 307 sic-test Noop :is identified for this nick
    // :chmurka.pirc.pl 319 sic-test Noop :@#onet_quiz @#scc @#sic
    // :chmurka.pirc.pl 312 sic-test Noop insomnia.pirc.pl :IRC lepszy od spania!
    // :chmurka.pirc.pl 301 sic-test Noop :gone
    // :chmurka.pirc.pl 671 sic-test Noop :is using a Secure Connection
    // :chmurka.pirc.pl 335 sic-test Noop :is a \u0002Bot\u0002 on pirc.pl
    // :chmurka.pirc.pl 330 sic-test Noop Noop :is logged in as
    // :chmurka.pirc.pl 313 sic-test k4be :is an IRC Operator
    // :chmurka.pirc.pl 276 sic-test k4be :has client certificate fingerprint 56fca76
    // :chmurka.pirc.pl 320 sic-test k4be :a Network Administrator
    // :chmurka.pirc.pl 318 sic-test Noop :End of /WHOIS list.
  };

  // @account=wariatnakaftan;msgid=THDuCqdstQzWng1N5ALKi4;time=2023-03-23T17:04:33.953Z :wariatnakaftan!uid502816@vhost:far.away AWAY
  // @account=wariatnakaftan;msgid=k9mhVRzgAdqLBnnr2YboOh;time=2023-03-23T17:14:37.516Z :wariatnakaftan!uid502816@vhost:far.away AWAY :Auto-away
  private readonly onAway = (): void => {
    //
  };

  // :netsplit.pirc.pl BATCH +0G9Zyu0qr7Jem5SdPufanF chathistory #sic
  // :netsplit.pirc.pl BATCH -0G9Zyu0qr7Jem5SdPufanF
  private readonly onBatch = (): void => {
    //
  };

  // :chmurka.pirc.pl CAP * LS * :sts=port=6697,duration=300 unrealircd.org/link-security=2 unrealircd.org/plaintext-policy=user=allow,oper=deny,server=deny unrealircd.org/history-storage=memory draft/metadata-notify-2 draft/metadata=maxsub=10 pirc.pl/killme away-notify invite-notify extended-join userhost-in-names multi-prefix cap-notify sasl=EXTERNAL,PLAIN setname tls chghost account-notify message-tags batch server-time account-tag echo-message labeled-response draft/chathistory draft/extended-monitor
  // :jowisz.pirc.pl CAP * LS :unrealircd.org/json-log
  // :saturn.pirc.pl CAP sic-test ACK :away-notify invite-notify extended-join userhost-in-names multi-prefix cap-notify account-notify message-tags batch server-time account-tag
  private readonly onCap = (): void => {
    const user = this.line.shift();
    const type = this.line.shift(); // LS, ACK, NAK, LIST, NEW, DEL

    if (user !== '*' || type !== 'LS') {
      return;
    }

    if (this.line?.[0] === '*') {
      this.line.shift();
    }

    const caps: Record<string, string> = {};

    const capList = this.line.join(' ').substring(1).split(' ');
    for (const cap of capList) {
      if (!cap.includes('=')) {
        caps[cap] = '';
      } else {
        const key = cap.substring(0, cap.indexOf('='));
        const value = cap.substring(cap.indexOf('=') + 1);
        caps[key] = value;
      }
    }

    const capsKeys = Object.keys(caps);
    if (capsKeys.includes('draft/metadata')) {
      ircRequestMetadata();
      setSupportedOption('metadata');
    }
  };

  // ERROR :Closing Link: [1.1.1.1] (Registration Timeout)
  // ERROR :Closing Link: [unknown@185.251.84.36] (SSL_do_accept failed)
  private readonly onError = (): void => {
    const message = this.line.join(' ').substring(1);

    setAddMessageToAllChannels({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      time: new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });

    if (!getIsCreatorCompleted()) {
      setCreatorProgress(0, i18next.t('creator.loading.error', { message }));
    }
  };

  // @msgid=WglKE4an4Y6MGcC9tVM7jV;time=2023-03-23T00:58:29.305Z :mero!~mero@D6D788C7.623ED634.C8132F93.IP INVITE sic-test :#sic
  private readonly onInvite = (): void => {
    const invited = this.line.shift();

    const channel = this.line.shift()?.substring(1);

    if (channel === undefined) {
      throw this.assert(this.onInvite, 'channel');
    }

    const { nick } = parseNick(this.sender, getUserModes());

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.invite', { nick, channel }),
      target: getCurrentChannelName(),
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // @msgid=oXhSn3eP0x5LlSJTX2SxJj-NXV6407yG5qKZnAWemhyGQ;time=2023-02-11T20:42:11.830Z :SIC-test!~SIC-test@D6D788C7.623ED634.C8132F93.IP JOIN #sic * :Simple Irc Client user
  // :mero-test!mero-test@LibraIRC-gd0.3t0.00m1ra.IP JOIN :#chat
  private readonly onJoin = (): void => {
    let channel = this.line.shift();
    const { nick, ident, hostname } = parseNick(this.sender, getUserModes());

    if (channel === undefined) {
      throw this.assert(this.onJoin, 'channel');
    }

    if (channel.startsWith(':')) {
      channel = channel.substring(1);
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.join', { nick }),
      target: channel,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.join,
      color: MessageColor.join,
    });

    if (nick === getCurrentNick()) {
      setCurrentChannelName(channel, ChannelCategory.channel);
      ircSendRawMessage(`MODE ${channel}`);
      if (isSupportedOption('WHOX')) {
        ircSendRawMessage(`WHO ${channel} %chtsunfra,152`);
      }
    } else {
      setAddUser({
        nick,
        ident,
        hostname,
        flags: [],
        channels: [{ name: channel, flags: [], maxPermission: defaultMaxPermission }],
      });
    }
  };

  // @account=ratler__;msgid=qDtfbJQ2Ym74HmVRslOgeZ-mLABGCzcOme4EdMIqCME+A;time=2023-03-20T21:23:29.512Z :ratler__!~pirc@vhost:ratler.ratler KICK #Religie sic-test :ratler__
  private readonly onKick = (): void => {
    const currentNick = getCurrentNick();

    const channel = this.line.shift();
    const kicked = this.line.shift();
    const reason = this.line.join(' ').substring(1) ?? '';

    if (kicked === undefined) {
      throw this.assert(this.onKick, 'kicked');
    }

    if (channel === undefined) {
      throw this.assert(this.onKick, 'channel');
    }

    const { nick } = parseNick(this.sender, getUserModes());

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t(`kernel.kick${kicked === currentNick ? '-you' : ''}`, { kicked, kickedBy: nick, channel, reason: reason.length !== 0 ? `(${reason})` : '' }),
      target: kicked === currentNick ? STATUS_CHANNEL : channel,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.kick,
      color: MessageColor.kick,
    });

    setRemoveUser(kicked, channel);

    if (kicked === currentNick) {
      setRemoveChannel(channel);

      setCurrentChannelName(STATUS_CHANNEL, ChannelCategory.status);
    }
  };

  // :server KILL scc_test :Killed (Nickname collision)
  private readonly onKill = (): void => {
    const me = this.line.shift();

    const { nick } = parseNick(this.sender, getUserModes());

    const reason = this.line.join(' ').substring(1) ?? '';

    setAddMessageToAllChannels({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.kill', { nick, reason: reason.length !== 0 ? `(${reason})` : '' }),
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // https://ircv3.net/specs/core/metadata-3.2
  // :netsplit.pirc.pl METADATA Noop avatar * :https://www.gravatar.com/avatar/55a2daf22200bd0f31cdb6b720911a74.jpg
  private readonly onMetadata = (): void => {
    const nickOrChannel = this.line.shift();
    const item = this.line.shift()?.toLowerCase();
    const flags = this.line.shift();
    const value = this.line.shift()?.substring(1);

    if (nickOrChannel === undefined) {
      throw this.assert(this.onMetadata, 'nickOrChannel');
    }

    if (!isChannel(nickOrChannel)) {
      if (item === 'avatar' && value !== undefined) {
        setUserAvatar(nickOrChannel, value);
      }
      if (item === 'color' && value !== undefined) {
        setUserColor(nickOrChannel, value);
      }
    }
  };

  // @draft/bot;msgid=TAwD3gzM6wZJulwi2hI0Ki;time=2023-03-04T19:13:32.450Z :Pomocnik!pomocny@bot:kanalowy.pomocnik MODE #Religie +h Merovingian
  // @account=PEPSISEXIBOMBA;msgid=c97PqlwAZZ8m2aRhCPMl8O;time=2023-03-19T20:35:06.649Z :PEPSISEXIBOMBA!~yooz@cloak:PEPSISEXIBOMBA MODE #Religie +b *!*@ukryty-D5702E9C.dip0.t-ipconnect.de
  // @draft/bot;msgid=g3x5HMBRj88mm32ndwtaUp;time=2023-03-19T21:08:35.308Z :Pomocnik!pomocny@bot:kanalowy.pomocnik MODE #Religie +v rupert__
  // :Merovingian MODE Merovingian :+x
  // :mero MODE mero :+xz
  // :mero-test MODE mero-test :+i
  // @draft/bot;msgid=zAfMgqBIJHiIfUCpDbbUfm;time=2023-03-27T23:49:47.290Z :ChanServ!ChanServ@serwisy.pirc.pl MODE #sic +qo Merovingian Merovingian
  // @account=Merovingian;msgid=Mo53vHEaXcEELccHhGfuVA;time=2023-03-27T23:52:26.726Z :Merovingian!~pirc@cloak:Merovingian MODE #sic +l 99
  private readonly onMode = (): void => {
    const serverChannelModes = getChannelModes();
    const serverUserModes = getUserModes();

    const { nick } = parseNick(this.sender, serverUserModes);

    const currentChannelName = getCurrentChannelName();

    const userOfChannel = this.line.shift();

    if (userOfChannel === undefined) {
      throw this.assert(this.onMode, 'userOfChannel');
    }

    let flags = this.line.shift() ?? '';
    if (flags.startsWith(':')) {
      flags = flags.substring(1);
    }

    if (isChannel(userOfChannel)) {
      // channel mode
      const channel = userOfChannel;

      let plusMinus: '+' | '-' | undefined;

      let flagParameterIndex = 0;
      for (let i = 0; i < flags.length; i++) {
        const flag = flags?.[i] ?? '';

        if (flag === '+') {
          plusMinus = '+';
        }
        if (flag === '-') {
          plusMinus = '-';
        }

        if (flag === '+' || flag === '-' || plusMinus === undefined) {
          continue; // set flag
        }

        const mode = `${plusMinus}${flag}`;
        const type = channelModeType(flag, serverChannelModes, serverUserModes);

        let message = '';
        const translate = `kernel.mode.channel.${plusMinus === '+' ? 'plus' : 'minus'}.${flag}`;

        switch (`${plusMinus}${type ?? ''}`) {
          case '+A':
          case '-A':
          case '+B':
          case '-B':
          case '+C': {
            // with params
            const param = this.line?.[flagParameterIndex];
            flagParameterIndex++;
            message = i18next.t(translate, { channel, setBy: nick, defaultValue: i18next.t('kernel.mode.channel.unknown-params', { channel, setBy: nick, mode, param }) });
            break;
          }
          case '-C':
          case '+D':
          case '-D':
            // single
            message = i18next.t(translate, { channel, setBy: nick, defaultValue: i18next.t('kernel.mode.channel.unknown', { channel, setBy: nick, mode }) });
            break;
          case '+U':
          case '-U': {
            // user flag
            const user = this.line?.[flagParameterIndex];
            if (user !== undefined) {
              flagParameterIndex++;
              message = i18next.t(translate, { user, setBy: nick, defaultValue: i18next.t('kernel.mode.channel.user', { user, setBy: nick, mode }) });
              setUpdateUserFlag(user, channel, plusMinus, flag, serverUserModes);
            }
            break;
          }
          default:
            message = i18next.t('kernel.mode.channel.unknown', { channel, setBy: nick, mode });
            console.log(`unknown mode: ${mode} / ${this.eventLine}`);
            break;
        }

        setAddMessage({
          id: uuidv4(),
          message,
          target: currentChannelName,
          time: this.tags?.time ?? new Date().toISOString(),
          category: MessageCategory.mode,
          color: MessageColor.mode,
        });
      }
    } else {
      // user mode
      const user = userOfChannel;

      let plusMinus: '+' | '-' | undefined;

      const flagsList = flags.split('');
      for (const flag of flagsList) {
        if (flag === '+') {
          plusMinus = '+';
        }
        if (flag === '-') {
          plusMinus = '-';
        }

        if (flag === '+' || flag === '-' || plusMinus === undefined) {
          continue; // set flag
        }

        let message = '';

        const mode = `${plusMinus}${flag}`;
        const translate = `kernel.mode.user.${plusMinus === '+' ? 'plus' : 'minus'}.${flag}`;

        // https://docs.inspircd.org/3/user-modes/
        switch (flag) {
          case 'B': // Marks the user as a bot.
          case 'c': // Requires other users to have a common channel before they can message this user.
          case 'd': // Prevents the user from receiving channel messages.
          case 'D': // Prevents the user from receiving private messages.
          case 'G': // Enables censoring messages sent to the user.
          case 'g': // Enables whitelisting of who can message the user.
          case 'H': // Hides the user's server operator status from unprivileged users.
          case 'h': // Marks the user as being available for help.
          case 'I': // Hides the channels the user is in from their /WHOIS response.
          case 'k': // Protects services pseudoclients against kicks, kills, and channel prefix mode changes.
          case 'L': // Prevents users from being redirected by channel mode L (redirect).
          case 'N': // Disables receiving channel history on join.
          case 'O': // Allows server operators to opt-in to overriding restrictions.
          case 'R': // Prevents users who are not logged into a services account from messaging the user.
          case 'r': // Marks the user as being logged into a services account.
          case 'S': // Enables stripping of IRC formatting codes from private messages.
          case 'T': // Enables blocking private messages that contain CTCPs.
          case 'W': // Informs the user when someone does a /WHOIS query on their nick.
          case 'x': // Enables hiding of the user's hostname.
          case 'z': // Prevents messages from being sent to or received from a user that is not connected using TLS (SSL).
            // TODO case yqaohv
            message = i18next.t(translate, { user, setBy: nick, defaultValue: i18next.t('kernel.mode.user.unknown', { user, setBy: nick, mode }) });
            // TODO add flag to user?
            break;
          default:
            message = i18next.t('kernel.mode.user.unknown', { user, setBy: nick, mode });
            console.log(`unknown mode: ${mode} / ${this.eventLine}`);
            break;
        }

        if (flag === 'r' || flag === 'x') {
          setAddMessage({
            id: uuidv4(),
            message,
            target: STATUS_CHANNEL,
            time: this.tags?.time ?? new Date().toISOString(),
            category: MessageCategory.mode,
            color: MessageColor.mode,
          });
          continue;
        }

        setAddMessage({
          id: uuidv4(),
          message,
          target: currentChannelName,
          time: this.tags?.time ?? new Date().toISOString(),
          category: MessageCategory.mode,
          color: MessageColor.mode,
        });
      }
    }
  };

  // @msgid=ls4nEYgZI42LXbsrfkcwcc;time=2023-02-12T14:20:53.072Z :Merovingian NICK :Niezident36707
  private readonly onNick = (): void => {
    const currentChannelName = getCurrentChannelName();
    const newNick = this.line.shift()?.substring(1);

    if (newNick === undefined) {
      throw this.assert(this.onNick, 'newNick');
    }

    const channels = getUserChannels(this.sender);
    setRenameUser(this.sender, newNick);

    for (const channel of channels) {
      setAddMessage({
        id: this.tags?.msgid ?? uuidv4(),
        message: i18next.t('kernel.nick', { from: this.sender, to: newNick }),
        target: channel,
        time: this.tags?.time ?? new Date().toISOString(),
        category: MessageCategory.info,
        color: MessageColor.info,
      });
    }

    if (this.sender === getCurrentNick()) {
      setNick(newNick);
    }
  };

  // @draft/bot;msgid=mcOQVkbTRyuCcC0Rso27IB;time=2023-02-22T00:20:59.308Z :Pomocnik!pomocny@bot:kanalowy.pomocnik NOTICE mero-test :[#religie] Dla trolli są inne kanały...
  // :insomnia.pirc.pl NOTICE SIC-test :You have to be connected for at least 20 seconds before being able to /LIST, please ignore the fake output above
  // :netsplit.pirc.pl NOTICE * :*** No ident response; username prefixed with ~
  // @draft/bot;msgid=hjeGCPN39ksrHai7Rs5gda;time=2023-02-04T22:48:46.472Z :NickServ!NickServ@serwisy.pirc.pl NOTICE SIC-test :Twój nick nie jest zarejestrowany. Aby dowiedzieć się, jak go zarejestrować i po co, zajrzyj na https://pirc.pl/serwisy/nickserv/
  // :irc.librairc.net NOTICE SIC-test :*** You cannot list within the first 60 seconds of connecting. Please try again later.
  private readonly onNotice = (): void => {
    const currentChannelName = getCurrentChannelName();

    const passwordRequired = /^(This nickname is registered and protected|Ten nick jest zarejestrowany i chroniony).*/;
    const list = /.*(You have to be connected for at least (?<secs1>\d+) seconds before being able to \/LIST|You cannot list within the first (?<secs2>\d+) seconds of connecting).*/;

    const target = this.line.shift();

    if (target === undefined) {
      throw this.assert(this.onNotice, 'target');
    }

    const message = this.line.join(' ').substring(1);

    const { nick } = parseNick(this.sender, getUserModes());

    if (nick === 'NickServ' && target === getCurrentNick() && passwordRequired.test(message)) {
      setIsPasswordRequired(true);
      setCreatorStep('password');
    }

    if (list.test(message) && target === getCurrentNick() && !getIsCreatorCompleted()) {
      const regexpGroups = list.exec(message)?.groups;
      const seconds = regexpGroups?.secs1 ?? regexpGroups?.secs2;

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

    setAddMessage({ ...newMessage, target: currentChannelName, id: this.tags?.msgid ?? uuidv4() });
  };

  // @account=Merovingian;msgid=hXPXorNkRXTwVOTU1RbpXN-0D/dV2/Monv6zuHQw/QAGw;time=2023-02-12T22:44:07.583Z :Merovingian!~pirc@cloak:Merovingian PART #sic :Opuścił kanał
  // :mero-test!mero-test@LibraIRC-gd0.3t0.00m1ra.IP PART :#chat
  private readonly onPart = (): void => {
    let channel = this.line.shift();
    const reason = this.line.join(' ').substring(1) ?? '';

    if (channel === undefined) {
      throw this.assert(this.onPart, 'channel');
    }

    if (channel.startsWith(':')) {
      channel = channel.substring(1);
    }

    const { nick } = parseNick(this.sender, getUserModes());

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.part', { nick, reason: reason.length !== 0 ? ` (${reason})` : '' }),
      target: channel,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.part,
      color: MessageColor.part,
    });

    setRemoveUser(nick, channel);

    if (nick === getCurrentNick()) {
      setRemoveChannel(channel);

      setCurrentChannelName(STATUS_CHANNEL, ChannelCategory.status);
    }
  };

  // PING :F549DB3
  private readonly onPing = (): void => {
    //
  };

  // @msgid=MIikH9lopbKqOQpz8ADjfP;time=2023-03-20T23:07:21.701Z :chmurka.pirc.pl PONG chmurka.pirc.pl :1679353641686
  private readonly onPong = (): void => {
    //
  };

  // @batch=UEaMMV4PXL3ymLItBEAhBO;msgid=498xEffzvc3SBMJsRPQ5Iq;time=2023-02-12T02:06:12.210Z :SIC-test2!~mero@D6D788C7.623ED634.C8132F93.IP PRIVMSG #sic :test 1
  // @msgid=HPS1IK0ruo8t691kVDRtFl;time=2023-02-12T02:11:26.770Z :SIC-test2!~mero@D6D788C7.623ED634.C8132F93.IP PRIVMSG #sic :test 4
  // @draft/bot;msgid=GQRN0k0RNmLY3Ai6f9g6Qk;time=2023-03-23T15:32:56.299Z :Global!Global@serwisy.pirc.pl PRIVMSG sic-test :VERSION
  private readonly onPrivMsg = (): void => {
    const serverUserModes = getUserModes();
    const currentChannelName = getCurrentChannelName();

    const target = this.line.shift();
    const message = this.line.join(' ').substring(1);
    const { nick } = parseNick(this.sender, serverUserModes);

    if (target === undefined) {
      throw this.assert(this.onPrivMsg, 'target');
    }

    if (message.startsWith('\x01')) {
      // ignore CTCP messages
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

  // @msgid=aGJTRBjAMOMRB6Ky2ucXbV-Gved4HyF6QNSHYfzOX1jOA;time=2023-03-11T00:52:21.568Z :mero!~mero@D6D788C7.623ED634.C8132F93.IP QUIT :Quit: Leaving
  private readonly onQuit = (): void => {
    const reason = this.line.join(' ').substring(1) ?? '';

    const { nick } = parseNick(this.sender, getUserModes());

    const message = {
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.quit', { nick, reason: reason.length !== 0 ? ` (${reason})` : '' }),
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.quit,
      color: MessageColor.quit,
    };

    setQuitUser(nick, message);
  };

  // @+draft/typing=active;+typing=active;account=kato_starszy;msgid=tsfqUigTlAhCbQYkVpty5s;time=2023-03-04T19:16:23.158Z :kato_starszy!~pirc@ukryty-FF796E25.net130.okay.pl TAGMSG #Religie
  private readonly onTagMsg = (): void => {
    const serverUserModes = getUserModes();

    const channel = this.line.shift();

    if (channel === undefined) {
      throw this.assert(this.onTagMsg, 'channel');
    }

    const { nick } = parseNick(this.sender, serverUserModes);

    const status = this.tags?.['+typing'] ?? this.tags?.['+draft/typing'];
    if (status === undefined) {
      return;
    }

    setTyping(channel, nick, status as UserTypingStatus);
  };

  // @account=Merovingian;msgid=33x8Q9DP1OpJVeJe3S7usg;time=2023-03-23T00:04:18.011Z :Merovingian!~pirc@cloak:Merovingian TOPIC #sic :Test 1
  private readonly onTopic = (): void => {
    const channel = this.line.shift();

    const topic = this.line.join(' ').substring(1);

    if (channel === undefined) {
      throw this.assert(this.onTopic, 'channel');
    }

    const { nick } = parseNick(this.sender, getUserModes());

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t(`kernel.topic`, { nick, topic }),
      target: channel,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });

    setTopic(channel, topic);
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

    ircSendList();
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
              setChannelTypes(value !== undefined ? value.split('') : defaultChannelTypes);
              break;
            case 'PREFIX':
              setUserModes(parseUserModes(value));
              break;
            case 'WHOX':
              setSupportedOption('WHOX');
              break;
            case 'CHANMODES':
              setChannelModes(parseChannelModes(value));
              break;
          }
        }

        if (parameter === 'NAMESX') {
          setSupportedOption('NAMESX');
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
  // :irc01-black.librairc.net 332 mero-test #chat :\u00034Welcome to #chat chatroom at http://librairc.net ~ for rules check https://goo.gl/Ksv9gr ~ If you need help type /join #help
  private readonly onRaw332 = (): void => {
    const nick = this.line.shift();
    const channel = this.line.shift();
    const topic = this.line.join(' ')?.substring(1);

    if (channel === undefined) {
      throw this.assert(this.onRaw332, 'channel');
    }

    setTopic(channel, topic);
  };

  // :chmurka.pirc.pl 333 SIC-test #sic Merovingian 1552692216
  private readonly onRaw333 = (): void => {
    const currentUser = this.line.shift();
    const channel = this.line.shift();
    const setBy = this.line.shift();
    const setTime = Number(this.line.shift() ?? '0');

    if (channel === undefined) {
      throw this.assert(this.onRaw333, 'channel');
    }
    if (setBy === undefined) {
      throw this.assert(this.onRaw333, 'setBy');
    }

    setTopicSetBy(channel, setBy, setTime);
  };

  // :irc01-black.librairc.net 353 mero-test = #chat :ircbot!ircbot@ircbot.botop.librairc.net Freak!Freak@LibraIRC-ug4.vta.mvnbg3.IP WatchDog!WatchDog@Watchdog.botop.librairc.net !~@iBan!iBan@iBan.botop.librairc.net !iBot!iBot@iBot.botop.librairc.net chip_x!chip@LibraIRC-i5e.6cr.4lkbg1.IP
  // :chmurka.pirc.pl 353 SIC-test = #sic :SIC-test!~SIC-test@D6D788C7.623ED634.C8132F93.IP @Noop!~Noop@AB43659:6EA4AE53:B58B785A:IP
  // :chmurka.pirc.pl 353 sic-test = #Religie :aleksa7!~aleksa7@vhost:kohana.aleksia +Alisha!~user@397FF66D:D8E4ABEE:5838DA6D:IP +ProrokCodzienny!~ProrokCod@AB43659:6EA4AE53:B58B785A:IP &@Pomocnik!pomocny@bot:kanalowy.pomocnik krejzus!krejzus@ukryty-13F27FB6.brb.dj Cienisty!Cienisty@cloak:Cienisty
  private readonly onRaw353 = (): void => {
    const currentUser = this.line.shift();
    const flags = this.line.shift();
    const channel = this.line.shift();

    if (channel === undefined) {
      throw this.assert(this.onRaw353, 'channel');
    }

    for (let user of this.line) {
      if (user.startsWith(':')) {
        user = user.substring(1);
      }

      const serverPrefixes = getUserModes();
      const { flags, nick, ident, hostname } = parseNick(user, serverPrefixes);

      if (getHasUser(nick)) {
        setJoinUser(nick, channel);
      } else {
        setAddUser({
          nick,
          ident,
          hostname,
          flags: [],
          channels: [
            {
              name: channel,
              flags,
              maxPermission: calculateMaxPermission(flags, serverPrefixes),
            },
          ],
        });
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

  // :insomnia.pirc.pl 432 * Merovingian :Nickname is unavailable: Being held for registered user
  // :irc01-black.librairc.net 432 * ioiijhjkkljkljlkj :Erroneous Nickname
  private readonly onRaw432 = (): void => {
    const currentChannelName = getCurrentChannelName();

    const asterix = this.line.shift();
    const nick = this.line.shift();

    if (nick === undefined) {
      throw this.assert(this.onRaw432, 'nick');
    }

    let message = this.line.join(' ');
    if (message.startsWith(':')) {
      message = message.substring(1);
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${nick} :${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :chmurka.pirc.pl 442 sic-test #kanjpa :You're not on that channel
  private readonly onRaw442 = (): void => {
    const currentChannelName = getCurrentChannelName();

    const nick = this.line.shift();
    const channel = this.line.shift();

    if (channel === undefined) {
      throw this.assert(this.onRaw442, 'channel');
    }

    let message = this.line.join(' ');
    if (message.startsWith(':')) {
      message = message.substring(1);
    }

    if (message === "You're not on that channel") {
      message = i18next.t('kernel.442.youre-not-on-that-channel');
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${channel} :${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :insomnia.pirc.pl 477 test #knajpa :You need a registered nick to join that channel.
  private readonly onRaw477 = (): void => {
    const currentChannelName = getCurrentChannelName();

    const nick = this.line.shift();
    const channel = this.line.shift();

    if (channel === undefined) {
      throw this.assert(this.onRaw477, 'channel');
    }

    let message = this.line.join(' ');
    if (message.startsWith(':')) {
      message = message.substring(1);
    }

    if (message === 'You need a registered nick to join that channel.') {
      message = i18next.t('kernel.477.you-need-a-registered-nick-to-join-that-channel');
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${channel} :${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :saturn.pirc.pl 474 mero-test #bog :Cannot join channel (+b)
  private readonly onRaw474 = (): void => {
    const currentChannelName = getCurrentChannelName();

    const nick = this.line.shift();
    const channel = this.line.shift();

    if (channel === undefined) {
      throw this.assert(this.onRaw474, 'channel');
    }

    let message = this.line.join(' ');
    if (message.startsWith(':')) {
      message = message.substring(1);
    }

    if (message === 'Cannot join channel (+b)') {
      message = i18next.t('kernel.474.cannot-join-channel-b');
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${channel} :${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :insomnia.pirc.pl 761 SIC-test Merovingian Avatar * :https://www.gravatar.com/avatar/8fadd198f40929e83421dd81e36f5637.jpg
  // :chmurka.pirc.pl 761 sic-test kazuisticsimplicity ignore_list * :0
  // :chmurka.pirc.pl 761 sic-test aqq color * :#0000ff
  private readonly onRaw761 = (): void => {
    const currentUser = this.line.shift();
    const nick = this.line.shift();
    const item = this.line.shift()?.toLowerCase();
    const flags = this.line.shift();
    const value = this.line.shift()?.substring(1);

    if (nick === undefined) {
      throw this.assert(this.onRaw761, 'nick');
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
}
