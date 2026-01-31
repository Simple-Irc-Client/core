/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  existChannel,
  isChannel,
  setAddChannel,
  setAddMessage,
  setAddMessageToAllChannels,
  setChannelAvatar,
  setIncreaseUnreadMessages,
  setRemoveChannel,
  setTopic,
  setTopicSetBy,
  setTyping,
} from '@features/channels/store/channels';
import {
  getChannelModes,
  getConnectedTime,
  getCurrentChannelName,
  getCurrentNick,
  getIsWizardCompleted,
  getServer,
  getUserModes,
  isSupportedOption,
  setChannelModes,
  setChannelTypes,
  setConnectedTime,
  setWizardProgress,
  setWizardStep,
  setCurrentChannelName,
  setCurrentUserAvatar,
  setCurrentUserFlag,
  setIsConnected,
  setIsConnecting,
  setIsPasswordRequired,
  setListRequestRemainingSeconds,
  setMonitorLimit,
  setNick,
  setSilenceLimit,
  setSupportedOption,
  setUserModes,
  setWatchLimit,
} from '@features/settings/store/settings';
import { getHasUser, getUser, getUserChannels, setAddUser, setJoinUser, setQuitUser, setRemoveUser, setRenameUser, setUpdateUserFlag, setUserAvatar, setUserColor, setUserAccount, setUserAway, setUserHost, setUserRealname } from '@features/users/store/users';
import { setMultipleMonitorOnline, setMultipleMonitorOffline, addMonitoredNick } from '@features/monitor/store/monitor';
import { ChannelCategory, MessageCategory, type UserTypingStatus, type ParsedIrcRawMessage } from '@shared/types';
import { channelModeType, calculateMaxPermission, parseChannelModes, parseIrcRawMessage, parseNick, parseUserModes, parseChannel } from './helpers';
import { ircRequestChatHistory, ircRequestMetadata, ircSendList, ircSendNamesXProto, ircSendRawMessage, ircConnectWithTLS, ircSendDisconnectCommand } from './network';
import {
  addAvailableCapabilities,
  endCapNegotiation,
  getCapabilitiesToRequest,
  isCapabilityEnabled,
  markCapabilitiesAcknowledged,
  markCapabilitiesRequested,
  parseCapabilityList,
  removeCapabilities,
  setAwaitingMoreCaps,
} from './capabilities';
import {
  getSaslAccount,
  getSaslPassword,
  getSaslState,
  handleSaslChallenge,
  setAuthenticatedAccount,
  setSaslState,
} from './sasl';
import {
  parseSTSValue,
  createSTSPolicy,
  isCurrentConnectionSecure,
  getCurrentConnectionHost,
  setPendingSTSUpgrade,
  getPendingSTSUpgrade,
  clearPendingSTSUpgrade,
  incrementSTSRetries,
  resetSTSRetries,
  hasExhaustedSTSRetries,
} from './sts';
import { setSTSPolicy } from './store/stsStore';
import {
  startBatch,
  endBatch,
  addToBatch,
  getMessageBatchId,
  resolveLabeledResponse,
  BATCH_TYPES,
  type BatchState,
} from './batch';
import i18next from '@/app/i18n';
import { MessageColor } from '@/config/theme';
import { defaultChannelTypes, defaultMaxPermission, clientVersion, clientSourceUrl } from '@/config/config';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { getDateFnsLocale } from '@shared/lib/dateLocale';
import { setAddChannelToList, setChannelListClear, setChannelListFinished } from '@features/channels/store/channelList';
import { addAwayMessage } from '@features/channels/store/awayMessages';
import { getCurrentUserFlags } from '@features/settings/store/settings';
import {
  addToChannelSettingsBanList,
  addToChannelSettingsExceptionList,
  addToChannelSettingsInviteList,
  setChannelSettingsBanList,
  setChannelSettingsExceptionList,
  setChannelSettingsInviteList,
  setChannelSettingsModes,
  setChannelSettingsIsLoading,
  setChannelSettingsIsBanListLoading,
  setChannelSettingsIsExceptionListLoading,
  setChannelSettingsIsInviteListLoading,
  useChannelSettingsStore,
} from '@features/channels/store/channelSettings';
import * as Sentry from '@sentry/react';

export interface IrcEvent {
  type: string;
  line?: string;
}

const STATUS_CHANNEL = 'Status';
const DEBUG_CHANNEL = 'Debug';

// https://www.rfc-editor.org/rfc/rfc2812

const RPL_WELCOME = '001';
const RPL_YOURHOST = '002';
const RPL_CREATED = '003';
const RPL_MYINFO = '004';
const RPL_ISUPPORT = '005';
const RPL_UMODEIS = '221';
const RPL_UMODES = '221';
const RPL_TRYAGAIN = '263';
const RPL_NONE = '300';
const RPL_AWAY = '301';
const RPL_USERHOST = '302';
const RPL_ISON = '303';
const RPL_TEXT = '304';
const RPL_UNAWAY = '305';
const RPL_NOWAWAY = '306';
const RPL_WHOISREGNICK = '307';
const RPL_RULESSTART = '308';
const RPL_ENDOFRULES = '309';
const RPL_WHOISHELPOP = '310';
const RPL_WHOISUSER = '311';
const RPL_WHOISSERVER = '312';
const RPL_WHOISOPERATOR = '313';
const RPL_WHOWASUSER = '314';
const RPL_ENDOFWHO = '315';
const reserved = '316';
const RPL_WHOISIDLE = '317';
const RPL_ENDOFWHOIS = '318';
const RPL_WHOISCHANNELS = '319';
const RPL_WHOISSPECIAL = '320';
const RPL_LISTSTART = '321';
const RPL_LIST = '322';
const RPL_ENDOFLIST = '323';
const RPL_CHANNELMODEIS = '324';
const RPL_CHANNEL_URL = '328';
const RPL_CREATIONTIME = '329';
const RPL_WHOISLOGGEDIN = '330';
const RPL_NOTOPIC = '331';
const RPL_TOPIC = '332';
const RPL_TOPICWHOTIME = '333';
const RPL_LISTSYNTAX = '334';
const RPL_WHOISBOT = '335';
// const RPL_INVITELIST = '336';
// const RPL_ENDOFINVITELIST = '337';
const RPL_USERIP = '340';
const RPL_INVITING = '341';
const RPL_SUMMONING = '342';
const RPL_WHOISCOUNTRY = '344';
const RPL_INVITELIST = '346';
const RPL_ENDOFINVITELIST = '347';
const RPL_INVITELISTEND = '347';
const RPL_EXCEPTLIST = '348';
const RPL_ENDOFEXCEPTLIST = '349';
const RPL_VERSION = '351';
const RPL_WHOREPLY = '352';
const RPL_NAMREPLY = '353';
const RPL_WHOSPCRPL = '354';
const RPL_KILLDONE = '361';
const RPL_CLOSING = '362';
const RPL_CLOSEEND = '363';
const RPL_LINKS = '364';
const RPL_ENDOFLINKS = '365';
const RPL_ENDOFNAMES = '366';
const RPL_BANLIST = '367';
const RPL_ENDOFBANLIST = '368';
const RPL_ENDOFWHOWAS = '369';
const RPL_INFO = '371';
const RPL_MOTD = '372';
const RPL_INFOSTART = '373';
const RPL_ENDOFINFO = '374';
const RPL_MOTDSTART = '375';
const RPL_ENDOFMOTD = '376';
const RPL_WHOISHOST = '378';
const RPL_WHOISMODES = '379';
const RPL_YOUREOPER = '381';
const RPL_REHASHING = '382';
const RPL_YOURESERVICE = '383';
const RPL_MYPORTIS = '384';
const RPL_NOTOPERANYMORE = '385';
const RPL_QLIST = '386';
const RPL_ENDOFQLIST = '387';
const RPL_ALIST = '388';
const RPL_ENDOFALIST = '389';
const RPL_TIME = '391';
const RPL_USERSSTART = '392';
const RPL_USERS = '393';
const RPL_ENDOFUSERS = '394';
const RPL_HOSTHIDDEN = '396';
const ERR_UNKNOWNERROR = '400';
const ERR_NOSUCHNICK = '401';
const ERR_NOSUCHSERVER = '402';
const ERR_NOSUCHCHANNEL = '403';
const ERR_CANNOTSENDTOCHAN = '404';
const ERR_TOOMANYCHANNELS = '405';
const ERR_WASNOSUCHNICK = '406';
const ERR_TOOMANYTARGETS = '407';
const ERR_NOSUCHSERVICE = '408';
const ERR_NOORIGIN = '409';
const ERR_INVALIDCAPCMD = '410';
const ERR_ERR_NOTEXTTOSEND = '412';
const ERR_NOTOPLEVEL = '413';
const ERR_WILDTOPLEVEL = '414';
const ERR_TOOMANYMATCHES = '416';
const ERR_UNKNOWNCOMMAND = '421';
const ERR_NOMOTD = '422';
const ERR_NOADMININFO = '423';
const ERR_FILEERROR = '424';
const ERR_NOOPERMOTD = '425';
const ERR_TOOMANYAWAY = '429';
const ERR_NONICKNAMEGIVEN = '431';
const ERR_ERRONEUSNICKNAME = '432';
const ERR_NICKNAMEINUSE = '433';
const ERR_NORULES = '434';
const ERR_SERVICECONFUSED = '435';
const ERR_NICKCOLLISION = '436';
const ERR_BANNICKCHANGE = '437';
const ERR_UNAVAILRESOURCE = '437';
const ERR_NCHANGETOOFAST = '438';
const ERR_TARGETTOOFAST = '439';
const ERR_SERVICESDOWN = '440';
const ERR_USERNOTINCHANNEL = '441';
const ERR_NOTONCHANNEL = '442';
const ERR_USERONCHANNEL = '443';
const ERR_NOLOGIN = '444';
const ERR_SUMMONDISABLED = '445';
const ERR_USERSDISABLED = '446';
const ERR_NONICKCHANGE = '447';
const ERR_FORBIDDENCHANNEL = '448';
const ERR_NOTREGISTERED = '451';
const ERR_HOSTILENAME = '455';
const ERR_NOHIDING = '459';
const ERR_NOTFORHALFOPS = '460';
const ERR_NEEDMOREPARAMS = '461';
const ERR_ALREADYREGISTRED = '462';
const ERR_NOPERMFORHOST = '463';
const ERR_PASSWDMISMATCH = '464';
const ERR_YOUREBANNEDCREEP = '465';
const ERR_YOUWILLBEBANNED = '466';
const ERR_KEYSET = '467';
const ERR_ONLYSERVERSCANCHANGE = '468';
const ERR_LINKSET = '469';
const ERR_LINKCHANNEL = '470';
const ERR_CHANNELISFULL = '471';
const ERR_UNKNOWNMODE = '472';
const ERR_INVITEONLYCHAN = '473';
const ERR_BANNEDFROMCHAN = '474';
const ERR_BADCHANNELKEY = '475';
const ERR_NEEDREGGEDNICK = '477';
const ERR_BANLISTFULL = '478';
const ERR_LINKFAIL = '479';
const ERR_CANNOTKNOCK = '480';
const ERR_NOPRIVILEGES = '481';
const ERR_CHANOPRIVSNEEDED = '482';
const ERR_NONONREG = '486';
const ERR_NOTFORUSERS = '487';
const ERR_SECUREONLYCHAN = '489';
const ERR_CHANOWNPRIVNEEDED = '499';
const ERR_TOOMANYJOINS = '500';
const ERR_UMODEUNKNOWNFLAG = '501';
const ERR_USERSDONTMATCH = '502';
const ERR_SILELISTFULL = '511';
const ERR_TOOMANYWATCH = '512';
const ERR_NEEDPONG = '513';
const ERR_TOOMANYDCC = '514';
const ERR_DISABLED = '517';
const ERR_NOINVITE = '518';
const ERR_ADMONLY = '519';
const ERR_OPERONLY = '520';
const ERR_LISTSYNTAX = '521';
const ERR_CANTSENDTOUSER = '531';
const RPL_REAWAY = '597';
const RPL_GONEAWAY = '598';
const RPL_NOTAWAY = '599';
const RPL_LOGON = '600';
const RPL_LOGOFF = '601';
const RPL_WATCHOFF = '602';
const RPL_WATCHSTAT = '603';
const RPL_NOWON = '604';
const RPL_NOWOFF = '605';
const RPL_WATCHLIST = '606';
const RPL_ENDOFWATCHLIST = '607';
const RPL_CLEARWATCH = '608';
const RPL_NOWISAWAY = '609';
const RPL_WHOISSECURE = '671';
const RPL_QUIETLIST = '728';
const RPL_ENDOFQUIETLIST = '729';
const RPL_MONONLINE = '730';
const RPL_MONOFFLINE = '731';
const RPL_MONLIST = '732';
const RPL_ENDOFMONLIST = '733';
const ERR_MONLISTFULL = '734';
const ERR_MLOCKRESTRICTED = '742';
const RPL_KEYVALUE = '761';
const RPL_METADATAEND = '762';
const RPL_METADATASUBOK = '770';
const RPL_LOGGEDIN = '900';
const RPL_LOGGEDOUT = '901';
const ERR_NICKLOCKED = '902';
const RPL_SASLSUCCESS = '903';
const ERR_SASLFAIL = '904';
const ERR_SASLTOOLONG = '905';
const ERR_SASLABORTED = '906';
const ERR_SASLALREADY = '907';
const ERR_CANNOTDOCOMMAND = '972';
const ERR_CANNOTCHANGECHANMODE = '974';

// Additional numerics from modern IRC spec
const RPL_BOUNCE = '010';
const RPL_PROCESSING = '020';
const RPL_YOURID = '042';
const RPL_STATSCOMMANDS = '212';
const RPL_STATSUPTIME = '242';
const RPL_ENDOFSTATS = '219';
const RPL_ADMINME = '256';
const RPL_ADMINLOC1 = '257';
const RPL_ADMINLOC2 = '258';
const RPL_ADMINEMAIL = '259';
const RPL_WHOISACTUALLY = '338';
const ERR_NORECIPIENT = '411';
const ERR_INPUTTOOLONG = '417';
const ERR_BADCHANMASK = '476';
const ERR_HELPNOTFOUND = '524';
const ERR_INVALIDKEY = '525';
const RPL_STARTTLS = '670';
const ERR_STARTTLS = '691';
const ERR_INVALIDMODEPARAM = '696';
const RPL_HELPSTART = '704';
const RPL_HELPTXT = '705';
const RPL_ENDOFHELP = '706';
const ERR_NOPRIVS = '723';
const RPL_SASLMECHS = '908';

export class Kernel {
  private tags: Record<string, string>;
  private sender: string;
  private command: string;
  private line: string[];

  private readonly event: IrcEvent;
  private readonly eventLine: string;

  constructor(event: IrcEvent) {
    this.tags = {};
    this.sender = '';
    this.command = '';
    this.line = [];

    this.event = event;
    this.eventLine = event?.line !== undefined ? event?.line.trim() : '';
  }

  // eslint-disable-next-line
  private logParseError = (func: Function, variable: string): void => {
    const error = new Error(`Kernel error - cannot parse ${variable} at ${func.name}`);
    Sentry.captureException(error, {
      extra: {
        eventLine: this.eventLine,
        command: this.command,
        sender: this.sender,
        tags: this.tags,
      },
    });
    console.error(error.message, { line: this.eventLine });
  };

  handle(): void {
    switch (this.event?.type) {
      case 'connect':
        this.handleConnect();
        break;
      case 'connected':
        this.handleConnected();
        break;
      case 'close':
        this.handleDisconnected();
        break;
      case 'socket close':
        this.handleSocketClose();
        break;
      case 'raw':
        if (this.event?.line !== undefined) {
          this.handleRaw(this.event.line);
        }
        break;
      default:
        console.log(`unhandled kernel event: ${this.event?.type ?? ''} ${this.event?.line ?? ''}`);
    }
  }

  private readonly handleConnect = (): void => {
    if (import.meta.env.DEV) {
      setAddChannel(DEBUG_CHANNEL, ChannelCategory.debug);
    }
    setAddChannel(STATUS_CHANNEL, ChannelCategory.status);
    setCurrentChannelName(STATUS_CHANNEL, ChannelCategory.status);
  };

  private readonly handleConnected = (): void => {
    setIsConnecting(false);
    setIsConnected(true);
    setConnectedTime(Math.floor(Date.now() / 1000));

    // Clear any pending STS upgrade now that we're connected
    clearPendingSTSUpgrade();
    resetSTSRetries();

    setAddMessageToAllChannels({
      id: uuidv4(),
      message: i18next.t('kernel.connected'),
      time: new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  private readonly handleDisconnected = (): void => {
    // Check if this is part of an STS upgrade - if so, trigger reconnection with TLS
    const stsUpgrade = getPendingSTSUpgrade();
    if (stsUpgrade) {
      // Delegate to handleSocketClose which handles STS reconnection
      this.handleSocketClose();
      return;
    }

    setIsConnecting(false);
    setIsConnected(false);

    // Reset STS retries on WebSocket disconnect
    resetSTSRetries();

    setAddMessageToAllChannels({
      id: uuidv4(),
      message: i18next.t('kernel.disconnected'),
      time: new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  /**
   * Handle IRC socket close event from backend.
   * This is triggered when the IRC connection closes (not the WebSocket).
   * Used for STS upgrade reconnection.
   */
  private readonly handleSocketClose = (): void => {
    // Check for pending STS upgrade
    const stsUpgrade = getPendingSTSUpgrade();
    if (stsUpgrade) {
      // Check if we've exhausted retries
      if (hasExhaustedSTSRetries()) {
        clearPendingSTSUpgrade();
        resetSTSRetries();
        setIsConnecting(false);
        setAddMessageToAllChannels({
          id: uuidv4(),
          message: i18next.t('kernel.stsUpgradeFailed'),
          time: new Date().toISOString(),
          category: MessageCategory.error,
          color: MessageColor.error,
        });
        return;
      }

      incrementSTSRetries();
      // Don't clear pending upgrade here - handleDisconnected needs it to avoid showing "Disconnected"
      // It will be cleared in handleConnected on successful TLS connection

      // Get server and nick for reconnection
      const server = getServer();
      const nick = getCurrentNick();

      if (server && nick) {
        // Keep connecting state visible during STS upgrade
        setIsConnecting(true);
        // Brief delay before reconnect with TLS
        setTimeout(() => {
          ircConnectWithTLS(server, nick, stsUpgrade.port);
        }, 1000);
      }
    }
  };

  private readonly handleRaw = (event: string): void => {
    const { tags, sender, command, line } = parseIrcRawMessage(event);
    this.tags = tags;
    this.sender = sender;
    this.command = command;
    this.line = line;

    if (import.meta.env.DEV) {
      setAddMessage({
        id: uuidv4(),
        message: `>> ${this.eventLine}`,
        target: DEBUG_CHANNEL,
        time: new Date().toISOString(),
        category: MessageCategory.info,
        color: MessageColor.serverFrom,
      });
    }

    // Check if this message belongs to an active batch
    // BATCH commands themselves should not be buffered
    if (command !== 'BATCH') {
      const batchId = getMessageBatchId({ tags, sender, command, line: [...line] });
      if (batchId) {
        // Buffer this message for later processing when batch ends
        addToBatch(batchId, { tags, sender, command, line: [...line] });
        return;
      }
    }

    switch (command) {
      case 'ACCOUNT':
        this.onAccount();
        break;
      case 'AUTHENTICATE':
        this.onAuthenticate();
        break;
      case 'AWAY':
        this.onAway();
        break;
      case 'BATCH':
        this.onBatch();
        break;
      case 'CAP':
        this.onCap();
        break;
      case 'CHGHOST':
        this.onChghost();
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
      case 'SETNAME':
        this.onSetname();
        break;
      case 'TAGMSG':
        this.onTagMsg();
        break;
      case 'TOPIC':
        this.onTopic();
        break;

      case RPL_WELCOME:
        this.onRaw001();
        break;
      case RPL_YOURHOST:
        this.onRaw002();
        break;
      case RPL_CREATED:
        this.onRaw003();
        break;
      case RPL_MYINFO:
        this.onRaw004();
        break;
      case RPL_ISUPPORT:
        this.onRaw005();
        break;
      case '250':
        this.onRaw250();
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
      case '276':
        this.onRaw276();
        break;
      case RPL_AWAY:
        this.onRaw301();
        break;
      case RPL_UNAWAY:
        this.onRaw305();
        break;
      case RPL_NOWAWAY:
        this.onRaw306();
        break;
      case RPL_WHOISREGNICK:
        this.onRaw307();
        break;
      case RPL_WHOISUSER:
        this.onRaw311();
        break;
      case RPL_WHOISSERVER:
        this.onRaw312();
        break;
      case RPL_WHOISOPERATOR:
        this.onRaw313();
        break;
      case RPL_ENDOFWHOIS:
        this.onRaw318();
        break;
      case RPL_WHOISCHANNELS:
        this.onRaw319();
        break;
      case RPL_WHOISSPECIAL:
        this.onRaw320();
        break;
      case RPL_LISTSTART:
        this.onRaw321();
        break;
      case RPL_LIST:
        this.onRaw322();
        break;
      case RPL_ENDOFLIST:
        this.onRaw323();
        break;
      case RPL_TOPIC:
        this.onRaw332();
        break;
      case RPL_TOPICWHOTIME:
        this.onRaw333();
        break;
      case RPL_CHANNELMODEIS:
        this.onRaw324();
        break;
      case RPL_INVITELIST:
        this.onRaw346();
        break;
      case RPL_ENDOFINVITELIST:
        this.onRaw347();
        break;
      case RPL_EXCEPTLIST:
        this.onRaw348();
        break;
      case RPL_ENDOFEXCEPTLIST:
        this.onRaw349();
        break;
      case RPL_BANLIST:
        this.onRaw367();
        break;
      case RPL_ENDOFBANLIST:
        this.onRaw368();
        break;
      case RPL_WHOISBOT:
        this.onRaw335();
        break;
      case RPL_NAMREPLY:
        this.onRaw353();
        break;
      case RPL_ENDOFNAMES:
        this.onRaw366();
        break;
      case RPL_MOTD:
        this.onRaw372();
        break;
      case RPL_MOTDSTART:
        this.onRaw375();
        break;
      case RPL_ENDOFMOTD:
        this.onRaw376();
        break;
      case RPL_HOSTHIDDEN:
        this.onRaw396();
        break;
      case ERR_ERRONEUSNICKNAME:
        this.onRaw432();
        break;
      case ERR_NOTONCHANNEL:
        this.onRaw442();
        break;
      case ERR_INVITEONLYCHAN:
        this.onRaw473();
        break;
      case ERR_BANNEDFROMCHAN:
        this.onRaw474();
        break;
      case ERR_NEEDREGGEDNICK:
        this.onRaw477();
        break;
      case RPL_KEYVALUE:
        this.onRaw761();
        break;
      case RPL_WHOISSECURE:
        this.onRaw671();
        break;
      case RPL_METADATAEND:
        this.onRaw762();
        break;
      case RPL_METADATASUBOK:
        this.onRaw770();
        break;
      case '766':
        this.onRaw766();
        break;

      // SASL authentication responses
      case RPL_LOGGEDIN:
        this.onRaw900();
        break;
      case RPL_LOGGEDOUT:
        this.onRaw901();
        break;
      case ERR_NICKLOCKED:
        this.onRaw902();
        break;
      case RPL_SASLSUCCESS:
        this.onRaw903();
        break;
      case ERR_SASLFAIL:
        this.onRaw904();
        break;
      case ERR_SASLTOOLONG:
        this.onRaw905();
        break;
      case ERR_SASLABORTED:
        this.onRaw906();
        break;
      case ERR_SASLALREADY:
        this.onRaw907();
        break;

      // MONITOR responses
      case RPL_MONONLINE:
        this.onRaw730();
        break;
      case RPL_MONOFFLINE:
        this.onRaw731();
        break;
      case RPL_MONLIST:
        this.onRaw732();
        break;
      case RPL_ENDOFMONLIST:
        this.onRaw733();
        break;
      case ERR_MONLISTFULL:
        this.onRaw734();
        break;

      // Server info and admin
      case RPL_BOUNCE:
        this.onRaw010();
        break;
      case RPL_PROCESSING:
        this.onRaw020();
        break;
      case RPL_YOURID:
        this.onRaw042();
        break;
      case RPL_STATSCOMMANDS:
        this.onRaw212();
        break;
      case RPL_ENDOFSTATS:
        this.onRaw219();
        break;
      case RPL_STATSUPTIME:
        this.onRaw242();
        break;
      case RPL_ADMINME:
        this.onRaw256();
        break;
      case RPL_ADMINLOC1:
        this.onRaw257();
        break;
      case RPL_ADMINLOC2:
        this.onRaw258();
        break;
      case RPL_ADMINEMAIL:
        this.onRaw259();
        break;

      // WHOIS additional replies
      case RPL_WHOWASUSER:
        this.onRaw314();
        break;
      case RPL_WHOISIDLE:
        this.onRaw317();
        break;
      case RPL_WHOISLOGGEDIN:
        this.onRaw330();
        break;
      case RPL_WHOISACTUALLY:
        this.onRaw338();
        break;
      case RPL_WHOISCOUNTRY:
        this.onRaw344();
        break;
      case RPL_ENDOFWHOWAS:
        this.onRaw369();
        break;
      case RPL_WHOISHOST:
        this.onRaw378();
        break;
      case RPL_WHOISMODES:
        this.onRaw379();
        break;

      // Channel info
      case RPL_CHANNEL_URL:
        this.onRaw328();
        break;
      case RPL_CREATIONTIME:
        this.onRaw329();
        break;
      case RPL_INVITING:
        this.onRaw341();
        break;
      case RPL_VERSION:
        this.onRaw351();
        break;
      case RPL_WHOSPCRPL:
        this.onRaw354();
        break;
      case RPL_LINKS:
        this.onRaw364();
        break;
      case RPL_ENDOFLINKS:
        this.onRaw365();
        break;
      case RPL_INFO:
        this.onRaw371();
        break;
      case RPL_ENDOFINFO:
        this.onRaw374();
        break;
      case RPL_YOUREOPER:
        this.onRaw381();
        break;
      case RPL_REHASHING:
        this.onRaw382();
        break;
      case RPL_TIME:
        this.onRaw391();
        break;

      // Error responses
      case ERR_NOSUCHNICK:
        this.onRaw401();
        break;
      case ERR_NOSUCHSERVER:
        this.onRaw402();
        break;
      case ERR_NOSUCHCHANNEL:
        this.onRaw403();
        break;
      case ERR_CANNOTSENDTOCHAN:
        this.onRaw404();
        break;
      case ERR_TOOMANYCHANNELS:
        this.onRaw405();
        break;
      case ERR_WASNOSUCHNICK:
        this.onRaw406();
        break;
      case ERR_NORECIPIENT:
        this.onRaw411();
        break;
      case ERR_ERR_NOTEXTTOSEND:
        this.onRaw412();
        break;
      case ERR_INPUTTOOLONG:
        this.onRaw417();
        break;
      case ERR_UNKNOWNCOMMAND:
        this.onRaw421();
        break;
      case ERR_NOMOTD:
        this.onRaw422();
        break;
      case ERR_NONICKNAMEGIVEN:
        this.onRaw431();
        break;
      case ERR_NICKNAMEINUSE:
        this.onRaw433();
        break;
      case ERR_NICKCOLLISION:
        this.onRaw436();
        break;
      case ERR_USERNOTINCHANNEL:
        this.onRaw441();
        break;
      case ERR_USERONCHANNEL:
        this.onRaw443();
        break;
      case ERR_NONICKCHANGE:
        this.onRaw447();
        break;
      case ERR_FORBIDDENCHANNEL:
        this.onRaw448();
        break;
      case ERR_NOTREGISTERED:
        this.onRaw451();
        break;
      case ERR_NEEDMOREPARAMS:
        this.onRaw461();
        break;
      case ERR_ALREADYREGISTRED:
        this.onRaw462();
        break;
      case ERR_PASSWDMISMATCH:
        this.onRaw464();
        break;
      case ERR_YOUREBANNEDCREEP:
        this.onRaw465();
        break;
      case ERR_CHANNELISFULL:
        this.onRaw471();
        break;
      case ERR_UNKNOWNMODE:
        this.onRaw472();
        break;
      case ERR_BADCHANNELKEY:
        this.onRaw475();
        break;
      case ERR_BADCHANMASK:
        this.onRaw476();
        break;
      case ERR_BANLISTFULL:
        this.onRaw478();
        break;
      case ERR_NOPRIVILEGES:
        this.onRaw481();
        break;
      case ERR_CHANOPRIVSNEEDED:
        this.onRaw482();
        break;
      case ERR_UMODEUNKNOWNFLAG:
        this.onRaw501();
        break;
      case ERR_USERSDONTMATCH:
        this.onRaw502();
        break;

      // Help system
      case ERR_HELPNOTFOUND:
        this.onRaw524();
        break;
      case RPL_HELPSTART:
        this.onRaw704();
        break;
      case RPL_HELPTXT:
        this.onRaw705();
        break;
      case RPL_ENDOFHELP:
        this.onRaw706();
        break;

      // Quiet list
      case RPL_QUIETLIST:
        this.onRaw728();
        break;
      case RPL_ENDOFQUIETLIST:
        this.onRaw729();
        break;

      // Additional SASL
      case RPL_SASLMECHS:
        this.onRaw908();
        break;

      // User modes
      case RPL_UMODEIS:
        this.onRaw221();
        break;

      // WATCH responses (friend list)
      case RPL_REAWAY:
        this.onRaw597();
        break;
      case RPL_GONEAWAY:
        this.onRaw598();
        break;
      case RPL_NOTAWAY:
        this.onRaw599();
        break;
      case RPL_LOGON:
        this.onRaw600();
        break;
      case RPL_LOGOFF:
        this.onRaw601();
        break;
      case RPL_WATCHOFF:
        this.onRaw602();
        break;
      case RPL_WATCHSTAT:
        this.onRaw603();
        break;
      case RPL_NOWON:
        this.onRaw604();
        break;
      case RPL_NOWOFF:
        this.onRaw605();
        break;
      case RPL_WATCHLIST:
        this.onRaw606();
        break;
      case RPL_ENDOFWATCHLIST:
        this.onRaw607();
        break;
      case RPL_CLEARWATCH:
        this.onRaw608();
        break;
      case RPL_NOWISAWAY:
        this.onRaw609();
        break;

      default:
        console.log(`unknown irc event: ${JSON.stringify(event)}`);
        break;
    }
  };

  // IRCv3 account-notify: User logs in or out of their account
  // :nick!user@host ACCOUNT accountname
  // :nick!user@host ACCOUNT *  (logged out)
  private readonly onAccount = (): void => {
    const { nick } = parseNick(this.sender, getUserModes());
    const account = this.line[0];

    if (!account || account === '*') {
      // User logged out
      setUserAccount(nick, null);
    } else {
      setUserAccount(nick, account);
    }
  };

  // IRCv3 away-notify: User away status changes
  // @account=wariatnakaftan;msgid=THDuCqdstQzWng1N5ALKi4;time=2023-03-23T17:04:33.953Z :wariatnakaftan!uid502816@vhost:far.away AWAY
  // @account=wariatnakaftan;msgid=k9mhVRzgAdqLBnnr2YboOh;time=2023-03-23T17:14:37.516Z :wariatnakaftan!uid502816@vhost:far.away AWAY :Auto-away
  private readonly onAway = (): void => {
    const { nick } = parseNick(this.sender, getUserModes());
    const reason = this.line.length > 0 ? this.line.join(' ').replace(/^:/, '') : undefined;

    if (reason) {
      // User is away
      setUserAway(nick, true, reason);
    } else {
      // User is back (no reason = not away)
      setUserAway(nick, false);
    }
  };

  // :netsplit.pirc.pl BATCH +0G9Zyu0qr7Jem5SdPufanF chathistory #sic
  // :netsplit.pirc.pl BATCH -0G9Zyu0qr7Jem5SdPufanF
  // BATCH +reference type [params...]
  // BATCH -reference
  private readonly onBatch = (): void => {
    const reference = this.line.shift();

    if (!reference) return;

    if (reference.startsWith('+')) {
      // Start batch
      const id = reference.substring(1);
      const type = this.line.shift() ?? '';
      const params = [...this.line];

      // Get the label tag for labeled-response correlation
      const label = this.tags?.label;

      startBatch(id, type, params, label);
    } else if (reference.startsWith('-')) {
      // End batch
      const id = reference.substring(1);
      const batch = endBatch(id);

      if (batch) {
        this.processBatch(batch);
      }
    }
  };

  /** Process a completed batch based on its type */
  private readonly processBatch = (batch: BatchState): void => {
    switch (batch.type) {
      case BATCH_TYPES.CHATHISTORY:
        this.processChatHistoryBatch(batch);
        break;
      case BATCH_TYPES.LABELED_RESPONSE:
        this.processLabeledResponseBatch(batch);
        break;
      case BATCH_TYPES.NETJOIN:
      case BATCH_TYPES.NETSPLIT:
        // Process each message individually (they're JOIN/QUIT messages)
        for (const message of batch.messages) {
          this.processBufferedMessage(message);
        }
        break;
      default:
        // Unknown batch type - process messages individually
        for (const message of batch.messages) {
          this.processBufferedMessage(message);
        }
    }
  };

  /** Process chathistory batch - insert messages at beginning of channel */
  private readonly processChatHistoryBatch = (batch: BatchState): void => {
    const target = batch.params[0];
    if (!target) return;

    // Process each message in the batch
    // Messages in chathistory are in chronological order (oldest first)
    for (const message of batch.messages) {
      this.processBufferedMessage(message);
    }
  };

  /** Process labeled-response batch */
  private readonly processLabeledResponseBatch = (batch: BatchState): void => {
    if (batch.referenceTag) {
      resolveLabeledResponse(batch.referenceTag, batch);
    }

    // Also process the messages normally
    for (const message of batch.messages) {
      this.processBufferedMessage(message);
    }
  };

  /** Process a buffered message from a batch */
  private readonly processBufferedMessage = (message: ParsedIrcRawMessage): void => {
    // Re-process the message through the normal handler
    // Store current state
    const prevTags = this.tags;
    const prevSender = this.sender;
    const prevCommand = this.command;
    const prevLine = this.line;

    // Set up for processing
    this.tags = message.tags;
    this.sender = message.sender;
    this.command = message.command;
    this.line = [...message.line];

    // Process based on command (simplified - just handle main ones)
    switch (message.command) {
      case 'PRIVMSG':
        this.onPrivMsg();
        break;
      case 'NOTICE':
        this.onNotice();
        break;
      case 'JOIN':
        this.onJoin();
        break;
      case 'PART':
        this.onPart();
        break;
      case 'QUIT':
        this.onQuit();
        break;
      case 'NICK':
        this.onNick();
        break;
      case 'TOPIC':
        this.onTopic();
        break;
      case 'MODE':
        this.onMode();
        break;
    }

    // Restore state
    this.tags = prevTags;
    this.sender = prevSender;
    this.command = prevCommand;
    this.line = prevLine;
  };

  // IRCv3 chghost: User's username or hostname changed
  // :nick!user@host CHGHOST newuser newhost
  private readonly onChghost = (): void => {
    const { nick } = parseNick(this.sender, getUserModes());
    const newIdent = this.line[0];
    const newHostname = this.line[1];

    if (newIdent && newHostname) {
      setUserHost(nick, newIdent, newHostname);

      // Display message in shared channels
      const channels = getUserChannels(nick);
      for (const channelName of channels) {
        setAddMessage({
          id: this.tags?.msgid ?? uuidv4(),
          message: i18next.t('kernel.chghost', { nick, ident: newIdent, hostname: newHostname }),
          target: channelName,
          time: this.tags?.time ?? new Date().toISOString(),
          category: MessageCategory.info,
          color: MessageColor.info,
        });
      }
    }
  };

  // :chmurka.pirc.pl CAP * LS * :sts=port=6697,duration=300 unrealircd.org/link-security=2 ...
  // :jowisz.pirc.pl CAP * LS :unrealircd.org/json-log
  // :saturn.pirc.pl CAP sic-test ACK :away-notify invite-notify extended-join ...
  // :server CAP * NAK :some-cap
  // :server CAP * NEW :new-cap
  // :server CAP * DEL :removed-cap
  private readonly onCap = (): void => {
    const target = this.line.shift(); // '*' or nick
    const subcommand = this.line.shift()?.toUpperCase(); // LS, ACK, NAK, LIST, NEW, DEL

    if (!subcommand) return;

    switch (subcommand) {
      case 'LS':
      case 'LIST': {
        // Check if this is a multiline response (has '*' before the cap list)
        const isMultiline = this.line?.[0] === '*';
        if (isMultiline) {
          this.line.shift();
          setAwaitingMoreCaps(true);
        } else {
          setAwaitingMoreCaps(false);
        }

        // Parse capabilities
        const capString = this.line.join(' ');
        const caps = parseCapabilityList(capString);
        addAvailableCapabilities(caps);

        // Check for STS capability - must upgrade to TLS if present and not already secure
        if (caps['sts'] && !isCurrentConnectionSecure()) {
          const parsed = parseSTSValue(caps['sts']);
          const host = getCurrentConnectionHost();
          if (parsed && host) {
            // Store the STS policy
            const policy = createSTSPolicy(host, parsed);
            setSTSPolicy(host, policy);

            // Queue upgrade - disconnect and reconnect with TLS
            setPendingSTSUpgrade({
              host,
              port: parsed.port,
              reason: 'sts_upgrade',
            });

            // Notify user
            setAddMessageToAllChannels({
              id: uuidv4(),
              message: i18next.t('kernel.stsUpgrade', { port: parsed.port }),
              time: new Date().toISOString(),
              category: MessageCategory.info,
              color: MessageColor.info,
            });

            // Send disconnect command to backend without closing WebSocket
            // Reconnection will happen when we receive 'socket close' event
            ircSendDisconnectCommand(i18next.t('kernel.stsUpgradeReason'));
            return;
          }
        } else if (caps['sts'] && isCurrentConnectionSecure()) {
          // Already on TLS, just update the policy duration
          const parsed = parseSTSValue(caps['sts']);
          const host = getCurrentConnectionHost();
          if (parsed && host) {
            const policy = createSTSPolicy(host, parsed);
            setSTSPolicy(host, policy);
          }
        }

        // If this is the last line, request capabilities
        if (!isMultiline) {
          this.requestCapabilities();
        }
        break;
      }

      case 'ACK': {
        // Server acknowledged our capability request
        const capString = this.line.join(' ');
        const cleanString = capString.startsWith(':') ? capString.substring(1) : capString;
        const ackCaps = cleanString.split(' ').filter((c) => c.length > 0);

        markCapabilitiesAcknowledged(ackCaps);

        // Mark capabilities as supported options for backward compatibility
        for (const cap of ackCaps) {
          setSupportedOption(cap);
        }

        // Handle special capabilities
        if (isCapabilityEnabled('draft/metadata') || isCapabilityEnabled('draft/metadata-notify-2')) {
          ircRequestMetadata();
          setSupportedOption('metadata');
        }

        // If SASL is acknowledged and we have credentials, start authentication
        if (isCapabilityEnabled('sasl') && getSaslAccount() && getSaslPassword()) {
          this.startSaslAuthentication();
        } else {
          // No SASL or no credentials, end CAP negotiation
          this.endCapNegotiation();
        }
        break;
      }

      case 'NAK': {
        // Server rejected our capability request
        const capString = this.line.join(' ');
        const cleanString = capString.startsWith(':') ? capString.substring(1) : capString;
        const nakCaps = cleanString.split(' ').filter((c) => c.length > 0);

        console.warn('CAP NAK - capabilities rejected:', nakCaps);

        // End negotiation even if some caps were rejected
        this.endCapNegotiation();
        break;
      }

      case 'NEW': {
        // Server advertises new capabilities (cap-notify)
        const capString = this.line.join(' ');
        const caps = parseCapabilityList(capString);
        addAvailableCapabilities(caps);

        // Request new capabilities if we want them
        const toRequest = getCapabilitiesToRequest();
        if (toRequest.length > 0) {
          ircSendRawMessage(`CAP REQ :${toRequest.join(' ')}`);
          markCapabilitiesRequested(toRequest);
        }
        break;
      }

      case 'DEL': {
        // Server removes capabilities (cap-notify)
        const capString = this.line.join(' ');
        const cleanString = capString.startsWith(':') ? capString.substring(1) : capString;
        const delCaps = cleanString.split(' ').filter((c) => c.length > 0);

        removeCapabilities(delCaps);
        break;
      }
    }
  };

  /** Request desired capabilities from server */
  private readonly requestCapabilities = (): void => {
    const toRequest = getCapabilitiesToRequest();

    if (toRequest.length > 0) {
      ircSendRawMessage(`CAP REQ :${toRequest.join(' ')}`);
      markCapabilitiesRequested(toRequest);
    } else {
      // No capabilities to request, end negotiation
      this.endCapNegotiation();
    }
  };

  /** Start SASL authentication */
  private readonly startSaslAuthentication = (): void => {
    setSaslState('requested');
    // Request PLAIN mechanism (most widely supported)
    ircSendRawMessage('AUTHENTICATE PLAIN');
  };

  /** End CAP negotiation and continue with registration */
  private readonly endCapNegotiation = (): void => {
    endCapNegotiation();
    ircSendRawMessage('CAP END');
  };

  // AUTHENTICATE + (server ready for credentials)
  // AUTHENTICATE <base64 challenge> (for mechanisms that need it)
  private readonly onAuthenticate = (): void => {
    const challenge = this.line[0] ?? '+';

    if (getSaslState() !== 'requested' && getSaslState() !== 'authenticating') {
      // Not expecting authentication
      return;
    }

    setSaslState('authenticating');

    const responses = handleSaslChallenge(challenge, 'PLAIN');

    if (responses === null) {
      // Abort authentication
      ircSendRawMessage('AUTHENTICATE *');
      setSaslState('failed');
      this.endCapNegotiation();
      return;
    }

    // Send response(s)
    for (const response of responses) {
      ircSendRawMessage(`AUTHENTICATE ${response}`);
    }
  };

  // :server 900 <nick> <nick>!<ident>@<host> <account> :You are now logged in as <account>
  private readonly onRaw900 = (): void => {
    const account = this.line[2] ?? null;
    setAuthenticatedAccount(account);

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.sasl.loggedIn', { account }),
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 901 <nick> <nick>!<ident>@<host> :You are now logged out
  private readonly onRaw901 = (): void => {
    setAuthenticatedAccount(null);

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.sasl.loggedOut'),
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 902 <nick> :You must use a nick assigned to you
  private readonly onRaw902 = (): void => {
    setSaslState('failed');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.sasl.nickLocked'),
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });

    this.endCapNegotiation();
  };

  // :server 903 <nick> :SASL authentication successful
  private readonly onRaw903 = (): void => {
    setSaslState('success');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.sasl.success'),
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });

    this.endCapNegotiation();
  };

  // :server 904 <nick> :SASL authentication failed
  private readonly onRaw904 = (): void => {
    setSaslState('failed');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.sasl.failed'),
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });

    this.endCapNegotiation();
  };

  // :server 905 <nick> :SASL message too long
  private readonly onRaw905 = (): void => {
    setSaslState('failed');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.sasl.tooLong'),
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });

    this.endCapNegotiation();
  };

  // :server 906 <nick> :SASL authentication aborted
  private readonly onRaw906 = (): void => {
    setSaslState('failed');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.sasl.aborted'),
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });

    this.endCapNegotiation();
  };

  // :server 907 <nick> :You have already authenticated using SASL
  private readonly onRaw907 = (): void => {
    // Already authenticated, just continue
    setSaslState('success');
    this.endCapNegotiation();
  };

  // MONITOR responses
  // :server 730 <nick> :nick1!user@host,nick2!user@host
  private readonly onRaw730 = (): void => {
    // RPL_MONONLINE - users are online
    const userList = this.line.slice(1).join(' ').replace(/^:/, '');
    if (!userList) return;

    const users = userList.split(',');
    const nicks: string[] = [];
    const userStrings: string[] = [];

    for (const user of users) {
      const nick = user.split('!')[0];
      if (nick) {
        nicks.push(nick);
        userStrings.push(user);
      }
    }

    if (nicks.length > 0) {
      setMultipleMonitorOnline(nicks, userStrings);
    }
  };

  // :server 731 <nick> :nick1,nick2,nick3
  private readonly onRaw731 = (): void => {
    // RPL_MONOFFLINE - users are offline
    const nickList = this.line.slice(1).join(' ').replace(/^:/, '');
    if (!nickList) return;

    const nicks = nickList.split(',').filter((n) => n.length > 0);

    if (nicks.length > 0) {
      setMultipleMonitorOffline(nicks);
    }
  };

  // :server 732 <nick> :nick1,nick2,nick3
  private readonly onRaw732 = (): void => {
    // RPL_MONLIST - list of monitored nicks
    const nickList = this.line.slice(1).join(' ').replace(/^:/, '');
    if (!nickList) return;

    const nicks = nickList.split(',').filter((n) => n.length > 0);

    for (const nick of nicks) {
      addMonitoredNick(nick);
    }
  };

  // :server 733 <nick> :End of MONITOR list
  private readonly onRaw733 = (): void => {
    // RPL_ENDOFMONLIST - end of monitor list
    // Nothing to do, just marks end of list
  };

  // :server 734 <nick> <limit> <nicks> :Monitor list is full
  private readonly onRaw734 = (): void => {
    // ERR_MONLISTFULL - cannot add more nicks to monitor
    const limit = this.line[1];
    const nicks = this.line[2];

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.monitor.listFull', { limit, nicks }),
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // ERROR :Closing Link: [1.1.1.1] (Registration Timeout)
  // ERROR :Closing Link: [unknown@185.251.84.36] (SSL_do_accept failed)
  private readonly onError = (): void => {
    const message = this.line.join(' ').substring(1);

    // Skip showing error during STS upgrade (server sends ERROR when we disconnect)
    if (getPendingSTSUpgrade()) {
      return;
    }

    setAddMessageToAllChannels({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      time: new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });

    if (!getIsWizardCompleted()) {
      setWizardProgress(0, i18next.t('wizard.loading.error', { message }));
    }
  };

  // @msgid=WglKE4an4Y6MGcC9tVM7jV;time=2023-03-23T00:58:29.305Z :mero!~mero@D6D788C7.623ED634.C8132F93.IP INVITE sic-test :#sic
  private readonly onInvite = (): void => {
    const invited = this.line.shift();

    const channel = this.line.shift()?.substring(1);

    if (channel === undefined) {
      this.logParseError(this.onInvite, 'channel');
      return;
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
      this.logParseError(this.onJoin, 'channel');
      return;
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

    // Add all users (including current user) to track channel-specific modes
    setAddUser({
      nick,
      ident,
      hostname,
      flags: [],
      channels: [{ name: channel, flags: [], maxPermission: defaultMaxPermission }],
    });

    if (nick === getCurrentNick()) {
      setCurrentChannelName(channel, ChannelCategory.channel);
      ircSendRawMessage(`MODE ${channel}`);
      if (isSupportedOption('WHOX')) {
        ircSendRawMessage(`WHO ${channel} %chtsunfra,152`);
      }
      // Request channel history if chathistory capability is enabled
      if (isCapabilityEnabled('draft/chathistory')) {
        ircRequestChatHistory(channel, 'LATEST', undefined, 50);
      }
    }
  };

  // @account=ratler__;msgid=qDtfbJQ2Ym74HmVRslOgeZ-mLABGCzcOme4EdMIqCME+A;time=2023-03-20T21:23:29.512Z :ratler__!~pirc@vhost:ratler.ratler KICK #Religie sic-test :ratler__
  private readonly onKick = (): void => {
    const currentNick = getCurrentNick();

    const channel = this.line.shift();
    const kicked = this.line.shift();
    const reason = this.line.join(' ').substring(1) ?? '';

    if (kicked === undefined) {
      this.logParseError(this.onKick, 'kicked');
      return;
    }

    if (channel === undefined) {
      this.logParseError(this.onKick, 'channel');
      return;
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
  // :netsplit.pirc.pl METADATA #channel avatar * :https://example.com/channel-avatar.png
  private readonly onMetadata = (): void => {
    const nickOrChannel = this.line.shift();
    const item = this.line.shift()?.toLowerCase();
    const flags = this.line.shift();
    const value = this.line.shift()?.substring(1);

    if (nickOrChannel === undefined) {
      this.logParseError(this.onMetadata, 'nickOrChannel');
      return;
    }

    if (isChannel(nickOrChannel)) {
      // Handle channel metadata
      if (item === 'avatar' && value !== undefined) {
        const avatarUrl = value.replace('{size}', '64');
        setChannelAvatar(nickOrChannel, avatarUrl);
      }
    } else {
      // Handle user metadata
      if (item === 'avatar' && value !== undefined) {
        const avatarUrl = value.replace('{size}', '64');
        setUserAvatar(nickOrChannel, avatarUrl);
        // Save avatar for current user to display in toolbar
        if (nickOrChannel === getCurrentNick()) {
          setCurrentUserAvatar(avatarUrl);
        }
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

    const userOrChannel = this.line.shift();

    if (userOrChannel === undefined) {
      this.logParseError(this.onMode, 'userOfChannel');
      return;
    }

    let flags = this.line.shift() ?? '';
    if (flags.startsWith(':')) {
      flags = flags.substring(1);
    }

    if (isChannel(userOrChannel)) {
      // channel mode
      const channel = userOrChannel;

      let plusMinus: '+' | '-' | undefined;

      let flagParameterIndex = 0;
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
          target: userOrChannel,
          time: this.tags?.time ?? new Date().toISOString(),
          category: MessageCategory.mode,
          color: MessageColor.mode,
        });
      }
    } else {
      // user mode
      const user = userOrChannel;

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

        // https://docs.inspircd.org/4/user-modes/
        switch (flag) {
          case 'i': // RFC 1459: Invisible - hides user from /who and /whois by non-opers.
          case 'w': // RFC 1459: Wallops - receives wallops messages.
          case 'o': // RFC 1459: Operator - marks the user as an IRC operator.
          case 's': // RFC 1459: Server notices - receives server notices.
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
          // Track current user's +r flag (registered status)
          if (flag === 'r' && user === getCurrentNick()) {
            setCurrentUserFlag('r', plusMinus === '+');
          }

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
      this.logParseError(this.onNick, 'newNick');
      return;
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
      this.logParseError(this.onNotice, 'target');
      return;
    }

    const message = this.line.join(' ').substring(1);

    const { nick } = parseNick(this.sender, getUserModes());

    if (nick === 'NickServ' && target === getCurrentNick() && passwordRequired.test(message)) {
      setIsPasswordRequired(true);
      setWizardStep('password');
    }

    if (list.test(message) && target === getCurrentNick() && !getIsWizardCompleted()) {
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
      this.logParseError(this.onPart, 'channel');
      return;
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
    const myNick = getCurrentNick();

    const target = this.line.shift();
    const message = this.line.join(' ').substring(1);
    const { nick } = parseNick(this.sender, serverUserModes);

    if (target === undefined) {
      this.logParseError(this.onPrivMsg, 'target');
      return;
    }

    if (message.startsWith('\x01')) {
      this.handleCtcp(nick, target, message);
      return;
    }

    // IRCv3 echo-message: When this is our own message echoed back by the server
    // We use the server-provided msgid and timestamp for accurate message ordering
    const isEchoMessage = nick === myNick && isCapabilityEnabled('echo-message');

    // Common IRC services - don't create query windows for echoed messages to these
    const IRC_SERVICES = ['nickserv', 'chanserv', 'memoserv', 'hostserv', 'botserv', 'operserv', 'global', 'saslserv'];
    const isServiceTarget = IRC_SERVICES.includes(target.toLowerCase());

    // Skip echoed messages to IRC services (they may contain passwords)
    if (isEchoMessage && isServiceTarget) {
      return;
    }

    const isPrivMessage = target === myNick;
    // For echo-message to a channel, target is the channel
    // For regular private message, target is our nick
    const messageTarget = isPrivMessage ? nick : target;

    if (!existChannel(messageTarget)) {
      setAddChannel(messageTarget, isPrivMessage ? ChannelCategory.priv : ChannelCategory.channel);

      // For private messages, add both participants to the channel's user list
      if (isPrivMessage) {
        // Add the other person
        if (getHasUser(nick)) {
          setJoinUser(nick, messageTarget);
        } else {
          setAddUser({ nick, ident: '', hostname: '', flags: [], channels: [{ name: messageTarget, flags: [], maxPermission: -1 }] });
        }
        // Add myself
        if (getHasUser(myNick)) {
          setJoinUser(myNick, messageTarget);
        } else {
          setAddUser({ nick: myNick, ident: '', hostname: '', flags: [], channels: [{ name: messageTarget, flags: [], maxPermission: -1 }] });
        }
      }
    }

    // Don't increase unread count for our own echoed messages
    if (messageTarget !== currentChannelName && !isEchoMessage) {
      setIncreaseUnreadMessages(messageTarget);
    }

    // Clear typing indicator (but not for our own echoed messages)
    if (messageTarget === currentChannelName && !isEchoMessage) {
      setTyping(messageTarget, nick, 'done');
    }

    const messageId = this.tags?.msgid ?? uuidv4();
    const messageTime = this.tags?.time ?? new Date().toISOString();

    setAddMessage({
      id: messageId,
      message,
      nick: getUser(nick) ?? nick,
      target: messageTarget,
      time: messageTime,
      category: MessageCategory.default,
      color: MessageColor.default,
      echoed: isEchoMessage,
    });

    // Check if user is away and message mentions their nick (not for echoed messages)
    if (!isEchoMessage) {
      const userFlags = getCurrentUserFlags();
      const isAway = userFlags.includes('away');
      if (isAway && message.toLowerCase().includes(myNick.toLowerCase())) {
        addAwayMessage({
          id: messageId,
          message,
          nick: getUser(nick) ?? nick,
          target: messageTarget,
          time: messageTime,
          category: MessageCategory.default,
          color: MessageColor.default,
          channel: messageTarget,
        });
      }
    }
  };

  // Handle CTCP (Client-To-Client Protocol) messages
  // CTCP messages are wrapped in \x01 characters: \x01COMMAND params\x01
  private readonly handleCtcp = (nick: string, target: string, message: string): void => {
    const myNick = getCurrentNick();
    const currentChannelName = getCurrentChannelName();

    // Remove \x01 (CTCP delimiter) characters and parse CTCP command
    const ctcpContent = message.split('\x01').join('');
    const spaceIndex = ctcpContent.indexOf(' ');
    const ctcpCommand = spaceIndex !== -1 ? ctcpContent.substring(0, spaceIndex) : ctcpContent;
    const ctcpParams = spaceIndex !== -1 ? ctcpContent.substring(spaceIndex + 1) : '';

    switch (ctcpCommand.toUpperCase()) {
      case 'ACTION':
        this.handleCtcpAction(nick, target, ctcpParams, myNick, currentChannelName);
        break;
      case 'VERSION':
        this.ctcpReply(nick, 'VERSION', clientVersion);
        break;
      case 'TIME':
        this.ctcpReply(nick, 'TIME', new Date().toString());
        break;
      case 'PING':
        this.ctcpReply(nick, 'PING', ctcpParams);
        break;
      case 'USERINFO':
        this.ctcpReply(nick, 'USERINFO', myNick);
        break;
      case 'SOURCE':
        this.ctcpReply(nick, 'SOURCE', clientSourceUrl);
        break;
      case 'CLIENTINFO':
        this.ctcpReply(nick, 'CLIENTINFO', 'ACTION VERSION TIME PING USERINFO SOURCE CLIENTINFO');
        break;
      default:
        // Unknown CTCP, ignore silently
        break;
    }
  };

  // Send CTCP reply via NOTICE
  private readonly ctcpReply = (target: string, command: string, response: string): void => {
    ircSendRawMessage(`NOTICE ${target} :\x01${command} ${response}\x01`);
  };

  // Handle CTCP ACTION (/me command)
  private readonly handleCtcpAction = (
    nick: string,
    target: string,
    action: string,
    myNick: string,
    currentChannelName: string
  ): void => {
    const isPrivMessage = target === myNick;
    const messageTarget = isPrivMessage ? nick : target;

    if (!existChannel(messageTarget)) {
      setAddChannel(messageTarget, isPrivMessage ? ChannelCategory.priv : ChannelCategory.channel);

      // For private messages, add both participants to the channel's user list
      if (isPrivMessage) {
        // Add the other person
        if (getHasUser(nick)) {
          setJoinUser(nick, messageTarget);
        } else {
          setAddUser({ nick, ident: '', hostname: '', flags: [], channels: [{ name: messageTarget, flags: [], maxPermission: -1 }] });
        }
        // Add myself
        if (getHasUser(myNick)) {
          setJoinUser(myNick, messageTarget);
        } else {
          setAddUser({ nick: myNick, ident: '', hostname: '', flags: [], channels: [{ name: messageTarget, flags: [], maxPermission: -1 }] });
        }
      }
    }

    if (messageTarget !== currentChannelName) {
      setIncreaseUnreadMessages(messageTarget);
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: action,
      nick: getUser(nick) ?? nick,
      target: messageTarget,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.me,
      color: MessageColor.me,
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

  // IRCv3 setname: User changed their real name
  // :nick!user@host SETNAME :New Real Name
  private readonly onSetname = (): void => {
    const { nick } = parseNick(this.sender, getUserModes());
    const realname = this.line.join(' ').replace(/^:/, '');

    if (realname) {
      setUserRealname(nick, realname);

      // Display message in shared channels
      const channels = getUserChannels(nick);
      for (const channelName of channels) {
        setAddMessage({
          id: this.tags?.msgid ?? uuidv4(),
          message: i18next.t('kernel.setname', { nick, realname }),
          target: channelName,
          time: this.tags?.time ?? new Date().toISOString(),
          category: MessageCategory.info,
          color: MessageColor.info,
        });
      }
    }
  };

  // @+draft/typing=active;+typing=active;account=kato_starszy;msgid=tsfqUigTlAhCbQYkVpty5s;time=2023-03-04T19:16:23.158Z :kato_starszy!~pirc@ukryty-FF796E25.net130.okay.pl TAGMSG #Religie
  private readonly onTagMsg = (): void => {
    const serverUserModes = getUserModes();

    const target = this.line.shift();

    if (target === undefined) {
      this.logParseError(this.onTagMsg, 'target');
      return;
    }

    const { nick } = parseNick(this.sender, serverUserModes);

    const status = this.tags?.['+typing'] ?? this.tags?.['+draft/typing'];
    if (status === undefined) {
      return;
    }

    // For private messages, target is our nick but the channel is stored under the sender's nick
    const isPrivMessage = target === getCurrentNick();
    const channel = isPrivMessage ? nick : target;

    // For private messages, create the PRIV channel if it doesn't exist
    // This allows typing to work even before the first message is received
    if (isPrivMessage && !existChannel(channel)) {
      setAddChannel(channel, ChannelCategory.priv);
    }

    setTyping(channel, nick, status as UserTypingStatus);
  };

  // @account=Merovingian;msgid=33x8Q9DP1OpJVeJe3S7usg;time=2023-03-23T00:04:18.011Z :Merovingian!~pirc@cloak:Merovingian TOPIC #sic :Test 1
  private readonly onTopic = (): void => {
    const channel = this.line.shift();

    const topic = this.line.join(' ').substring(1);

    if (channel === undefined) {
      this.logParseError(this.onTopic, 'channel');
      return;
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
    const myNick = this.line.shift();

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
    const myNick = this.line.shift();

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
    const myNick = this.line.shift();

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
    const myNick = this.line.shift();

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
    const myNick = this.line.shift();

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
            case 'WATCH':
              setWatchLimit(value !== undefined ? parseInt(value, 10) : 0);
              break;
            case 'MONITOR':
              setMonitorLimit(value !== undefined ? parseInt(value, 10) : 0);
              break;
            case 'SILENCE':
              setSilenceLimit(value !== undefined ? parseInt(value, 10) : 0);
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

  // :tantalum.libera.chat 250 Merovingian :Highest connection count: 2682 (2681 clients) (389463 connections received)
  private readonly onRaw250 = (): void => {
    const myNick = this.line.shift();

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

  // :saturn.pirc.pl 251 SIC-test :There are 158 users and 113 invisible on 10 servers
  private readonly onRaw251 = (): void => {
    const myNick = this.line.shift();

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
    const myNick = this.line.shift();

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
    const myNick = this.line.shift();

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
    const myNick = this.line.shift();

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
    const myNick = this.line.shift();

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
    const myNick = this.line.shift();
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
    const myNick = this.line.shift();
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

  // :chmurka.pirc.pl 276 sic-test k4be :has client certificate fingerprint 56fca76
  private readonly onRaw276 = (): void => {
    const currentChannelName = getCurrentChannelName();

    const myNick = this.line.shift();
    const user = this.line.shift();
    const message = this.line.join(' ').substring(1);

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.276', { user, message }),
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :chmurka.pirc.pl 301 sic-test Noop :gone
  private readonly onRaw301 = (): void => {
    const currentChannelName = getCurrentChannelName();

    const myNick = this.line.shift();
    const user = this.line.shift();
    let reason = this.line.join(' ');
    if (reason.startsWith(':')) {
      reason = reason.substring(1);
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.301', { user, reason: reason.length !== 0 ? `(${reason})` : '' }),
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :insomnia.pirc.pl 305 mero-test-2354324234 :You are no longer marked as being away
  private readonly onRaw305 = (): void => {
    const myNick = this.line.shift();
    let message = this.line.join(' ').substring(1);

    if (message === 'You are no longer marked as being away') {
      message = i18next.t('kernel.305.you-are-no-longer-marked-as-being-away');
    }

    setAddMessageToAllChannels({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });

    setCurrentUserFlag("away", false)
    if (myNick) setUserAway(myNick, false);
  };

  // :bzyk.pirc.pl 306 mero-test-2354324234 :You have been marked as being away
  private readonly onRaw306 = (): void => {
    const myNick = this.line.shift();
    let message = this.line.join(' ').substring(1);

    if (message === 'You have been marked as being away') {
      message = i18next.t('kernel.306.you-have-been-marked-as-being-away');
    }

    setAddMessageToAllChannels({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });

    setCurrentUserFlag("away", true)
    if (myNick) setUserAway(myNick, true);
  };

  // :chmurka.pirc.pl 307 sic-test Noop :is identified for this nick
  private readonly onRaw307 = (): void => {
    const currentChannelName = getCurrentChannelName();

    const myNick = this.line.shift();
    const user = this.line.shift();
    let message = this.line.join(' ').substring(1);

    if (message === 'is identified for this nick') {
      message = i18next.t('kernel.307.is-identified-for-this-nick');
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.307', { user, message }),
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :chmurka.pirc.pl 311 sic-test Noop ~Noop ukryty-29093CCD.compute-1.amazonaws.com * :*
  private readonly onRaw311 = (): void => {
    const currentChannelName = getCurrentChannelName();

    const myNick = this.line.shift();
    const user = this.line.shift();
    const host = this.line.join(' ');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.311', { user, host }),
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :chmurka.pirc.pl 312 sic-test Noop insomnia.pirc.pl :IRC lepszy od spania!
  private readonly onRaw312 = (): void => {
    const currentChannelName = getCurrentChannelName();

    const myNick = this.line.shift();
    const user = this.line.shift();

    const server = this.line.shift();

    let description = this.line.join(' ');
    if (description.startsWith(':')) {
      description = description.substring(1);
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.312', { user, server, description: description.length !== 0 ? `(${description})` : '' }),
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :chmurka.pirc.pl 313 sic-test k4be :is an IRC Operator
  private readonly onRaw313 = (): void => {
    const currentChannelName = getCurrentChannelName();

    const myNick = this.line.shift();
    const user = this.line.shift();

    let message = this.line.join(' ').substring(1);

    if (message === 'is an IRC Operator') {
      message = i18next.t('kernel.313.is-an-irc-operator');
    }
    if (message === 'is a Network Service') {
      message = i18next.t('kernel.313.is-a-network-service');
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.313', { user, message }),
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :chmurka.pirc.pl 318 sic-test Noop :End of /WHOIS list.
  private readonly onRaw318 = (): void => {
    //
  };

  // :chmurka.pirc.pl 319 sic-test Noop :@#onet_quiz @#scc @#sic
  private readonly onRaw319 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const serverUserModes = getUserModes();

    const myNick = this.line.shift();
    const user = this.line.shift();
    const channels = this.line
      .join(' ')
      .substring(1)
      .split(' ')
      .map((channel) => parseChannel(channel, serverUserModes))
      .join(' ');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.319', { user, channels }),
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :chmurka.pirc.pl 320 sic-test k4be :a Network Administrator
  private readonly onRaw320 = (): void => {
    const currentChannelName = getCurrentChannelName();

    const myNick = this.line.shift();
    const user = this.line.shift();

    let message = this.line.join(' ').substring(1);

    if (message === 'a Network Administrator') {
      message = i18next.t('kernel.320.a-network-administrator');
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.320', { user, message }),
      target: currentChannelName,
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
    const myNick = this.line.shift();

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
    const myNick = this.line.shift();
    const channel = this.line.shift();
    const topic = this.line.join(' ')?.substring(1);

    if (channel === undefined) {
      this.logParseError(this.onRaw332, 'channel');
      return;
    }

    setTopic(channel, topic);
  };

  // :chmurka.pirc.pl 333 SIC-test #sic Merovingian 1552692216
  private readonly onRaw333 = (): void => {
    const myNick = this.line.shift();
    const channel = this.line.shift();
    const setBy = this.line.shift();
    const setTime = Number(this.line.shift() ?? '0');

    if (channel === undefined) {
      this.logParseError(this.onRaw333, 'channel');
      return;
    }
    if (setBy === undefined) {
      this.logParseError(this.onRaw333, 'setBy');
      return;
    }

    setTopicSetBy(channel, setBy, setTime);
  };

  // :chmurka.pirc.pl 335 sic-test Noop :is a \u0002Bot\u0002 on pirc.pl
  private readonly onRaw335 = (): void => {
    const currentChannelName = getCurrentChannelName();

    const myNick = this.line.shift();
    const user = this.line.shift();

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.335', { user }),
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :irc01-black.librairc.net 353 mero-test = #chat :ircbot!ircbot@ircbot.botop.librairc.net Freak!Freak@LibraIRC-ug4.vta.mvnbg3.IP WatchDog!WatchDog@Watchdog.botop.librairc.net !~@iBan!iBan@iBan.botop.librairc.net !iBot!iBot@iBot.botop.librairc.net chip_x!chip@LibraIRC-i5e.6cr.4lkbg1.IP
  // :chmurka.pirc.pl 353 SIC-test = #sic :SIC-test!~SIC-test@D6D788C7.623ED634.C8132F93.IP @Noop!~Noop@AB43659:6EA4AE53:B58B785A:IP
  // :chmurka.pirc.pl 353 sic-test = #Religie :aleksa7!~aleksa7@vhost:kohana.aleksia +Alisha!~user@397FF66D:D8E4ABEE:5838DA6D:IP +ProrokCodzienny!~ProrokCod@AB43659:6EA4AE53:B58B785A:IP &@Pomocnik!pomocny@bot:kanalowy.pomocnik krejzus!krejzus@ukryty-13F27FB6.brb.dj Cienisty!Cienisty@cloak:Cienisty
  private readonly onRaw353 = (): void => {
    const myNick = this.line.shift();
    const flags = this.line.shift();
    const channel = this.line.shift();

    if (channel === undefined) {
      this.logParseError(this.onRaw353, 'channel');
      return;
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
    const myNick = this.line.shift();

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
    const myNick = this.line.shift();

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
    const myNick = this.line.shift();

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
    const myNick = this.line.shift();

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
      this.logParseError(this.onRaw432, 'nick');
      return;
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

    if (!getIsWizardCompleted()) {
      setWizardProgress(0, i18next.t('wizard.loading.error', { message }));
    }
  };

  // :chmurka.pirc.pl 442 sic-test #kanjpa :You're not on that channel
  private readonly onRaw442 = (): void => {
    const currentChannelName = getCurrentChannelName();

    const myNick = this.line.shift();
    const channel = this.line.shift();

    if (channel === undefined) {
      this.logParseError(this.onRaw442, 'channel');
      return;
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

  // :chommik.pirc.pl 473 sic-test #sic :Cannot join channel (+i)
  private readonly onRaw473 = (): void => {
    const currentChannelName = getCurrentChannelName();

    const myNick = this.line.shift();
    const channel = this.line.shift();

    if (channel === undefined) {
      this.logParseError(this.onRaw473, 'channel');
      return;
    }

    let message = this.line.join(' ');
    if (message.startsWith(':')) {
      message = message.substring(1);
    }

    if (message === 'Cannot join channel (+i)') {
      message = i18next.t('kernel.473.cannot-join-channel-i');
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

    const myNick = this.line.shift();
    const channel = this.line.shift();

    if (channel === undefined) {
      this.logParseError(this.onRaw474, 'channel');
      return;
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

  // :insomnia.pirc.pl 477 test #knajpa :You need a registered nick to join that channel.
  private readonly onRaw477 = (): void => {
    const currentChannelName = getCurrentChannelName();

    const myNick = this.line.shift();
    const channel = this.line.shift();

    if (channel === undefined) {
      this.logParseError(this.onRaw477, 'channel');
      return;
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

  // :chmurka.pirc.pl 671 sic-test Noop :is using a Secure Connection
  private readonly onRaw671 = (): void => {
    const currentChannelName = getCurrentChannelName();

    const myNick = this.line.shift();
    const user = this.line.shift();

    let message = this.line.join(' ').substring(1);

    if (message === 'is using a Secure Connection') {
      message = i18next.t('kernel.671.is-using-a-secure-connection');
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.671', { user, message }),
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
    const myNick = this.line.shift();
    const nick = this.line.shift();
    const item = this.line.shift()?.toLowerCase();
    const flags = this.line.shift();
    const value = this.line.shift()?.substring(1);

    if (nick === undefined) {
      this.logParseError(this.onRaw761, 'nick');
      return;
    }

    if (item === 'avatar' && value !== undefined) {
      const avatarUrl = value.replace('{size}', '64');
      setUserAvatar(nick, avatarUrl);
      if (nick.toLowerCase() === getCurrentNick().toLowerCase()) {
        setCurrentUserAvatar(avatarUrl);
      }
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

  // :jowisz.pirc.pl 770 Merovingian :avatar
  // :jowisz.pirc.pl 770 Merovingian :status
  // :jowisz.pirc.pl 770 Merovingian :bot
  private readonly onRaw770 = (): void => {
    this.line.shift(); // myNick
    const metadataItem = this.line.join(' ').substring(1).toLowerCase();

    if (metadataItem.length > 0) {
      setSupportedOption(`metadata-${metadataItem}`);
    }
  };

  // :server 324 mynick #channel +tnl 50
  // :chmurka.pirc.pl 324 sic-test #sic +nt
  private readonly onRaw324 = (): void => {
    const myNick = this.line.shift();
    const channel = this.line.shift();
    let modesString = this.line.shift() ?? '';

    if (channel === undefined) {
      return;
    }

    // Check if this is for the channel settings dialog
    const settingsChannel = useChannelSettingsStore.getState().channelName;
    if (settingsChannel !== channel) {
      return;
    }

    // Parse modes string like "+ntl" with params like "50"
    const modes: Record<string, string | boolean> = {};
    const serverChannelModes = getChannelModes();

    if (modesString.startsWith('+')) {
      modesString = modesString.substring(1);
    }

    let paramIndex = 0;
    for (const flag of modesString.split('')) {
      const type = channelModeType(flag, serverChannelModes, getUserModes());

      if (type === 'B' || type === 'C') {
        // Modes that take a parameter
        const param = this.line[paramIndex];
        if (param !== undefined) {
          modes[flag] = param;
          paramIndex++;
        }
      } else if (type === 'D') {
        // Simple flag modes
        modes[flag] = true;
      }
    }

    setChannelSettingsModes(modes);
    setChannelSettingsIsLoading(false);
  };

  // :server 346 mynick #channel mask!*@* setter 1234567890
  private readonly onRaw346 = (): void => {
    const myNick = this.line.shift();
    const channel = this.line.shift();
    const mask = this.line.shift();
    const setBy = this.line.shift() ?? '';
    const setTime = Number(this.line.shift() ?? '0');

    if (channel === undefined || mask === undefined) {
      return;
    }

    const settingsChannel = useChannelSettingsStore.getState().channelName;
    if (settingsChannel !== channel) {
      return;
    }

    addToChannelSettingsInviteList({ mask, setBy, setTime });
  };

  // :server 347 mynick #channel :End of Channel Invite List
  private readonly onRaw347 = (): void => {
    setChannelSettingsIsInviteListLoading(false);
  };

  // :server 348 mynick #channel mask!*@* setter 1234567890
  private readonly onRaw348 = (): void => {
    const myNick = this.line.shift();
    const channel = this.line.shift();
    const mask = this.line.shift();
    const setBy = this.line.shift() ?? '';
    const setTime = Number(this.line.shift() ?? '0');

    if (channel === undefined || mask === undefined) {
      return;
    }

    const settingsChannel = useChannelSettingsStore.getState().channelName;
    if (settingsChannel !== channel) {
      return;
    }

    addToChannelSettingsExceptionList({ mask, setBy, setTime });
  };

  // :server 349 mynick #channel :End of Channel Exception List
  private readonly onRaw349 = (): void => {
    setChannelSettingsIsExceptionListLoading(false);
  };

  // :server 367 mynick #channel mask!*@* setter 1234567890
  private readonly onRaw367 = (): void => {
    const myNick = this.line.shift();
    const channel = this.line.shift();
    const mask = this.line.shift();
    const setBy = this.line.shift() ?? '';
    const setTime = Number(this.line.shift() ?? '0');

    if (channel === undefined || mask === undefined) {
      return;
    }

    const settingsChannel = useChannelSettingsStore.getState().channelName;
    if (settingsChannel !== channel) {
      return;
    }

    addToChannelSettingsBanList({ mask, setBy, setTime });
  };

  // :server 368 mynick #channel :End of Channel Ban List
  private readonly onRaw368 = (): void => {
    setChannelSettingsIsBanListLoading(false);
  };

  // ============================================
  // Additional IRC numerics from modern spec
  // ============================================

  // :server 010 * <hostname> <port> :Server redirect
  private readonly onRaw010 = (): void => {
    const asterisk = this.line.shift();
    const hostname = this.line.shift();
    const port = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.010', { hostname, port, message, defaultValue: `Server redirect: ${hostname}:${port} ${message}` }),
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 020 * :Please wait while we process your connection.
  private readonly onRaw020 = (): void => {
    const asterisk = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 042 nick uniqueID :your unique ID
  private readonly onRaw042 = (): void => {
    const myNick = this.line.shift();
    const uniqueId = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${uniqueId} ${message}`,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 212 nick COMMAND count bytes remote_count
  private readonly onRaw212 = (): void => {
    const myNick = this.line.shift();
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

  // :server 219 nick type :End of STATS report
  private readonly onRaw219 = (): void => {
    const myNick = this.line.shift();
    const statsType = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${statsType} ${message}`,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // RPL_UMODEIS (221) - User modes reply
  // :server 221 yournick +iwx
  private readonly onRaw221 = (): void => {
    const myNick = this.line.shift();
    const modes = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.221', { modes, defaultValue: `Your user modes: ${modes}` }),
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 242 nick :Server Up 14 days, 2:34:56
  private readonly onRaw242 = (): void => {
    const myNick = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 256 nick :Administrative info about server
  private readonly onRaw256 = (): void => {
    const myNick = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 257 nick :Location line 1
  private readonly onRaw257 = (): void => {
    const myNick = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 258 nick :Location line 2
  private readonly onRaw258 = (): void => {
    const myNick = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 259 nick :Admin email
  private readonly onRaw259 = (): void => {
    const myNick = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 314 nick user host * :realname (WHOWAS reply)
  private readonly onRaw314 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const user = this.line.shift();
    const host = this.line.join(' ');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.314', { user, host, defaultValue: `${user} was ${host}` }),
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 317 mynick user idle signon :seconds idle, signon time
  private readonly onRaw317 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const user = this.line.shift();
    const idleSeconds = Number(this.line.shift() ?? '0');
    const signonTime = Number(this.line.shift() ?? '0');

    const idleFormatted = this.formatDuration(idleSeconds);
    const signonDate = signonTime > 0 ? format(new Date(signonTime * 1000), 'd MMM yyyy HH:mm', { locale: getDateFnsLocale() }) : '';

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.317', { user, idle: idleFormatted, signon: signonDate, defaultValue: `${user} idle ${idleFormatted}, signed on ${signonDate}` }),
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // Helper to format seconds into human readable duration
  private readonly formatDuration = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
  };

  // :server 328 mynick #channel :http://channel-url.com
  private readonly onRaw328 = (): void => {
    const myNick = this.line.shift();
    const channel = this.line.shift();
    const url = this.line.join(' ').replace(/^:/, '');

    if (channel) {
      setAddMessage({
        id: this.tags?.msgid ?? uuidv4(),
        message: i18next.t('kernel.328', { channel, url, defaultValue: `Channel URL: ${url}` }),
        target: channel,
        time: this.tags?.time ?? new Date().toISOString(),
        category: MessageCategory.info,
        color: MessageColor.info,
      });
    }
  };

  // :server 329 mynick #channel timestamp
  private readonly onRaw329 = (): void => {
    const myNick = this.line.shift();
    const channel = this.line.shift();
    const timestamp = Number(this.line.shift() ?? '0');

    if (channel && timestamp > 0) {
      const createdDate = format(new Date(timestamp * 1000), 'd MMM yyyy HH:mm', { locale: getDateFnsLocale() });
      setAddMessage({
        id: this.tags?.msgid ?? uuidv4(),
        message: i18next.t('kernel.329', { channel, created: createdDate, defaultValue: `Channel created: ${createdDate}` }),
        target: channel,
        time: this.tags?.time ?? new Date().toISOString(),
        category: MessageCategory.info,
        color: MessageColor.info,
      });
    }
  };

  // :server 330 mynick user account :is logged in as
  private readonly onRaw330 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const user = this.line.shift();
    const account = this.line.shift();
    let message = this.line.join(' ').replace(/^:/, '');

    if (message === 'is logged in as') {
      message = i18next.t('kernel.330.is-logged-in-as', { defaultValue: 'is logged in as' });
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.330', { user, account, message, defaultValue: `${user} ${message} ${account}` }),
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 338 mynick user actualuser@actualhost actualIP :Actual user@host, Actual IP
  private readonly onRaw338 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const user = this.line.shift();
    const actualUserHost = this.line.shift();
    const actualIP = this.line.shift();

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.338', { user, actualUserHost, actualIP, defaultValue: `${user} ${actualUserHost} ${actualIP}` }),
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 341 mynick invitedUser #channel
  private readonly onRaw341 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const invitedUser = this.line.shift();
    const channel = this.line.shift();

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.341', { user: invitedUser, channel, defaultValue: `Inviting ${invitedUser} to ${channel}` }),
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 344 mynick user country :is connecting from Country
  private readonly onRaw344 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const user = this.line.shift();
    const country = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.344', { user, country, message, defaultValue: `${user} ${message} ${country}` }),
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 351 mynick version.debuglevel server :comments
  private readonly onRaw351 = (): void => {
    const myNick = this.line.shift();
    const version = this.line.shift();
    const server = this.line.shift();
    const comments = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${server} ${version} ${comments}`,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 354 mynick querytype channel user host server nick flags hopcount :realname (WHOX reply)
  private readonly onRaw354 = (): void => {
    const myNick = this.line.shift();
    const queryType = this.line.shift();
    const channel = this.line.shift();
    const ident = this.line.shift();
    const hostname = this.line.shift();
    const server = this.line.shift();
    const nick = this.line.shift();
    const flags = this.line.shift() ?? '';
    const hopcount = this.line.shift();
    const realname = this.line.join(' ').replace(/^:/, '');

    if (!nick || !channel) return;

    const serverPrefixes = getUserModes();

    // Parse flags to extract user modes (H=here, G=gone/away, *=oper, @%+ = channel modes)
    const channelFlags: string[] = [];
    let isAway = false;

    for (const flag of flags.split('')) {
      if (flag === 'G') {
        isAway = true;
      } else if (serverPrefixes.some(p => p.symbol === flag)) {
        channelFlags.push(flag);
      }
    }

    // Update or add user
    if (getHasUser(nick)) {
      setUserHost(nick, ident ?? '', hostname ?? '');
      if (realname) setUserRealname(nick, realname);
      if (isAway) setUserAway(nick, true);
    } else {
      setAddUser({
        nick,
        ident: ident ?? '',
        hostname: hostname ?? '',
        flags: [],
        channels: [{
          name: channel,
          flags: channelFlags,
          maxPermission: calculateMaxPermission(channelFlags, serverPrefixes),
        }],
      });
    }
  };

  // :server 364 mynick mask server :hopcount info
  private readonly onRaw364 = (): void => {
    const myNick = this.line.shift();
    const mask = this.line.shift();
    const server = this.line.shift();
    const info = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${mask} ${server} ${info}`,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 365 mynick mask :End of /LINKS list
  private readonly onRaw365 = (): void => {
    const myNick = this.line.shift();
    const mask = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${mask} ${message}`,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 369 mynick nick :End of WHOWAS
  private readonly onRaw369 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const nick = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `* ${nick} ${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 371 mynick :info line
  private readonly onRaw371 = (): void => {
    const myNick = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 374 mynick :End of INFO list
  private readonly onRaw374 = (): void => {
    const myNick = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 378 mynick nick :is connecting from *@host IP
  private readonly onRaw378 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const user = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.378', { user, message, defaultValue: `* ${user} ${message}` }),
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 379 mynick nick :is using modes +iwx
  private readonly onRaw379 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const user = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.379', { user, message, defaultValue: `* ${user} ${message}` }),
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 381 mynick :You are now an IRC operator
  private readonly onRaw381 = (): void => {
    const myNick = this.line.shift();
    let message = this.line.join(' ').replace(/^:/, '');

    if (message === 'You are now an IRC operator') {
      message = i18next.t('kernel.381.you-are-now-an-irc-operator', { defaultValue: message });
    }

    setAddMessageToAllChannels({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 382 mynick config.conf :Rehashing
  private readonly onRaw382 = (): void => {
    const myNick = this.line.shift();
    const configFile = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${configFile} ${message}`,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 391 mynick server :timestamp
  private readonly onRaw391 = (): void => {
    const myNick = this.line.shift();
    const server = this.line.shift();
    const timeString = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.391', { server, time: timeString, defaultValue: `${server}: ${timeString}` }),
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // Error numerics
  // :server 401 mynick target :No such nick/channel
  private readonly onRaw401 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const target = this.line.shift();
    let message = this.line.join(' ').replace(/^:/, '');

    if (message === 'No such nick/channel') {
      message = i18next.t('kernel.401.no-such-nick-channel', { defaultValue: message });
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${target}: ${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 402 mynick server :No such server
  private readonly onRaw402 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const server = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${server}: ${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 403 mynick #channel :No such channel
  private readonly onRaw403 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const channel = this.line.shift();
    let message = this.line.join(' ').replace(/^:/, '');

    if (message === 'No such channel') {
      message = i18next.t('kernel.403.no-such-channel', { defaultValue: message });
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${channel}: ${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 404 mynick #channel :Cannot send to channel
  private readonly onRaw404 = (): void => {
    const myNick = this.line.shift();
    const channel = this.line.shift();
    let message = this.line.join(' ').replace(/^:/, '');

    if (message === 'Cannot send to channel') {
      message = i18next.t('kernel.404.cannot-send-to-channel', { defaultValue: message });
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${channel}: ${message}`,
      target: channel ?? STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 405 mynick #channel :You have joined too many channels
  private readonly onRaw405 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const channel = this.line.shift();
    let message = this.line.join(' ').replace(/^:/, '');

    if (message === 'You have joined too many channels') {
      message = i18next.t('kernel.405.too-many-channels', { defaultValue: message });
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${channel}: ${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 406 mynick nick :There was no such nickname
  private readonly onRaw406 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const nick = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${nick}: ${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 411 mynick :No recipient given
  private readonly onRaw411 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 412 mynick :No text to send
  private readonly onRaw412 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    let message = this.line.join(' ').replace(/^:/, '');

    if (message === 'No text to send') {
      message = i18next.t('kernel.412.no-text-to-send', { defaultValue: message });
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 417 mynick :Input line was too long
  private readonly onRaw417 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 421 mynick COMMAND :Unknown command
  private readonly onRaw421 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const command = this.line.shift();
    let message = this.line.join(' ').replace(/^:/, '');

    if (message === 'Unknown command') {
      message = i18next.t('kernel.421.unknown-command', { defaultValue: message });
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${command}: ${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 422 mynick :MOTD File is missing
  private readonly onRaw422 = (): void => {
    const myNick = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 431 mynick :No nickname given
  private readonly onRaw431 = (): void => {
    const myNick = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });

    if (!getIsWizardCompleted()) {
      setWizardProgress(0, i18next.t('wizard.loading.error', { message }));
    }
  };

  // :server 433 * nick :Nickname is already in use
  private readonly onRaw433 = (): void => {
    const asterisk = this.line.shift();
    const nick = this.line.shift();
    let message = this.line.join(' ').replace(/^:/, '');

    if (message === 'Nickname is already in use') {
      message = i18next.t('kernel.433.nickname-in-use', { defaultValue: message });
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${nick}: ${message}`,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });

    if (!getIsWizardCompleted()) {
      setWizardProgress(0, i18next.t('wizard.loading.error', { message: `${nick}: ${message}` }));
    }
  };

  // :server 436 mynick nick :Nickname collision KILL
  private readonly onRaw436 = (): void => {
    const myNick = this.line.shift();
    const nick = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessageToAllChannels({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${nick}: ${message}`,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 441 mynick nick #channel :They aren't on that channel
  private readonly onRaw441 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const nick = this.line.shift();
    const channel = this.line.shift();
    let message = this.line.join(' ').replace(/^:/, '');

    if (message === "They aren't on that channel") {
      message = i18next.t('kernel.441.not-on-channel', { defaultValue: message });
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${nick} ${channel}: ${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 443 mynick nick #channel :is already on channel
  private readonly onRaw443 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const nick = this.line.shift();
    const channel = this.line.shift();
    let message = this.line.join(' ').replace(/^:/, '');

    if (message === 'is already on channel') {
      message = i18next.t('kernel.443.already-on-channel', { defaultValue: message });
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${nick} ${channel}: ${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 447 mynick :Cannot change nickname while on #channel (+N)
  private readonly onRaw447 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 448 mynick channel :Cannot join channel: invalid name
  private readonly onRaw448 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const channel = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${channel}: ${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 451 * :You have not registered
  private readonly onRaw451 = (): void => {
    const asterisk = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 461 mynick COMMAND :Not enough parameters
  private readonly onRaw461 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const command = this.line.shift();
    let message = this.line.join(' ').replace(/^:/, '');

    if (message === 'Not enough parameters') {
      message = i18next.t('kernel.461.not-enough-parameters', { defaultValue: message });
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${command}: ${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 462 mynick :You may not reregister
  private readonly onRaw462 = (): void => {
    const myNick = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 464 * :Password incorrect
  private readonly onRaw464 = (): void => {
    const asterisk = this.line.shift();
    let message = this.line.join(' ').replace(/^:/, '');

    if (message === 'Password incorrect') {
      message = i18next.t('kernel.464.password-incorrect', { defaultValue: message });
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });

    if (!getIsWizardCompleted()) {
      setWizardProgress(0, i18next.t('wizard.loading.error', { message }));
    }
  };

  // :server 465 mynick :You are banned from this server
  private readonly onRaw465 = (): void => {
    const myNick = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessageToAllChannels({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });

    if (!getIsWizardCompleted()) {
      setWizardProgress(0, i18next.t('wizard.loading.error', { message }));
    }
  };

  // :server 471 mynick #channel :Cannot join channel (+l)
  private readonly onRaw471 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const channel = this.line.shift();
    let message = this.line.join(' ').replace(/^:/, '');

    if (message === 'Cannot join channel (+l)') {
      message = i18next.t('kernel.471.channel-full', { defaultValue: message });
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${channel}: ${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 472 mynick char :is unknown mode char to me
  private readonly onRaw472 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const modeChar = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${modeChar}: ${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 475 mynick #channel :Cannot join channel (+k)
  private readonly onRaw475 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const channel = this.line.shift();
    let message = this.line.join(' ').replace(/^:/, '');

    if (message === 'Cannot join channel (+k)') {
      message = i18next.t('kernel.475.bad-channel-key', { defaultValue: message });
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${channel}: ${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 476 mynick #channel :Bad Channel Mask
  private readonly onRaw476 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const channel = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${channel}: ${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 478 mynick #channel mask :Channel ban list is full
  private readonly onRaw478 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const channel = this.line.shift();
    const mask = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${channel} ${mask}: ${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 481 mynick :Permission Denied- You're not an IRC operator
  private readonly onRaw481 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 482 mynick #channel :You're not channel operator
  private readonly onRaw482 = (): void => {
    const myNick = this.line.shift();
    const channel = this.line.shift();
    let message = this.line.join(' ').replace(/^:/, '');

    if (message === "You're not channel operator") {
      message = i18next.t('kernel.482.not-channel-operator', { defaultValue: message });
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${channel}: ${message}`,
      target: channel ?? STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 501 mynick :Unknown MODE flag
  private readonly onRaw501 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 502 mynick :Cannot change mode for other users
  private readonly onRaw502 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // :server 524 mynick topic :Help not found
  private readonly onRaw524 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const topic = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `${topic}: ${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.error,
      color: MessageColor.error,
    });
  };

  // WATCH responses (597-609) - Friend list notifications
  // :server 597 yournick nick ident host timestamp :is now away
  private readonly onRaw597 = (): void => {
    const myNick = this.line.shift();
    const nick = this.line.shift();
    // User is now away again (after returning)
    if (nick) {
      setAddMessage({
        id: this.tags?.msgid ?? uuidv4(),
        message: i18next.t('kernel.watchaway', { nick, defaultValue: `${nick} is now away` }),
        target: STATUS_CHANNEL,
        time: this.tags?.time ?? new Date().toISOString(),
        category: MessageCategory.info,
        color: MessageColor.info,
      });
    }
  };

  // :server 598 yournick nick ident host timestamp :went away
  private readonly onRaw598 = (): void => {
    const myNick = this.line.shift();
    const nick = this.line.shift();
    // User went away
    if (nick) {
      setAddMessage({
        id: this.tags?.msgid ?? uuidv4(),
        message: i18next.t('kernel.watchaway', { nick, defaultValue: `${nick} is now away` }),
        target: STATUS_CHANNEL,
        time: this.tags?.time ?? new Date().toISOString(),
        category: MessageCategory.info,
        color: MessageColor.info,
      });
    }
  };

  // :server 599 yournick nick ident host timestamp :is no longer away
  private readonly onRaw599 = (): void => {
    const myNick = this.line.shift();
    const nick = this.line.shift();
    // User is back from away
    if (nick) {
      setAddMessage({
        id: this.tags?.msgid ?? uuidv4(),
        message: i18next.t('kernel.watchback', { nick, defaultValue: `${nick} is no longer away` }),
        target: STATUS_CHANNEL,
        time: this.tags?.time ?? new Date().toISOString(),
        category: MessageCategory.info,
        color: MessageColor.info,
      });
    }
  };

  // :server 600 yournick nick ident host timestamp :logged on
  private readonly onRaw600 = (): void => {
    const myNick = this.line.shift();
    const nick = this.line.shift();
    // User came online - use monitor store for consistency
    if (nick) {
      setMultipleMonitorOnline([nick]);
      setAddMessage({
        id: this.tags?.msgid ?? uuidv4(),
        message: i18next.t('kernel.watchonline', { nick, defaultValue: `${nick} is now online` }),
        target: STATUS_CHANNEL,
        time: this.tags?.time ?? new Date().toISOString(),
        category: MessageCategory.info,
        color: MessageColor.info,
      });
    }
  };

  // :server 601 yournick nick ident host timestamp :logged off
  private readonly onRaw601 = (): void => {
    const myNick = this.line.shift();
    const nick = this.line.shift();
    // User went offline
    if (nick) {
      setMultipleMonitorOffline([nick]);
      setAddMessage({
        id: this.tags?.msgid ?? uuidv4(),
        message: i18next.t('kernel.watchoffline', { nick, defaultValue: `${nick} is now offline` }),
        target: STATUS_CHANNEL,
        time: this.tags?.time ?? new Date().toISOString(),
        category: MessageCategory.info,
        color: MessageColor.info,
      });
    }
  };

  // :server 602 yournick nick ident host timestamp :stopped watching
  private readonly onRaw602 = (): void => {
    const myNick = this.line.shift();
    const nick = this.line.shift();
    // Stopped watching nick
    if (nick) {
      setAddMessage({
        id: this.tags?.msgid ?? uuidv4(),
        message: i18next.t('kernel.watchremoved', { nick, defaultValue: `Stopped watching ${nick}` }),
        target: STATUS_CHANNEL,
        time: this.tags?.time ?? new Date().toISOString(),
        category: MessageCategory.info,
        color: MessageColor.info,
      });
    }
  };

  // :server 603 yournick :You have X and are on Y WATCH entries
  private readonly onRaw603 = (): void => {
    const myNick = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');
    // Watch statistics
    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 604 yournick nick ident host timestamp :is online
  private readonly onRaw604 = (): void => {
    const myNick = this.line.shift();
    const nick = this.line.shift();
    // User is currently online (when adding to watch list)
    if (nick) {
      setMultipleMonitorOnline([nick]);
      setAddMessage({
        id: this.tags?.msgid ?? uuidv4(),
        message: i18next.t('kernel.watchonline', { nick, defaultValue: `${nick} is now online` }),
        target: STATUS_CHANNEL,
        time: this.tags?.time ?? new Date().toISOString(),
        category: MessageCategory.info,
        color: MessageColor.info,
      });
    }
  };

  // :server 605 yournick nick * * 0 :is offline
  private readonly onRaw605 = (): void => {
    const myNick = this.line.shift();
    const nick = this.line.shift();
    // User is currently offline (when adding to watch list)
    if (nick) {
      setMultipleMonitorOffline([nick]);
      setAddMessage({
        id: this.tags?.msgid ?? uuidv4(),
        message: i18next.t('kernel.watchoffline', { nick, defaultValue: `${nick} is now offline` }),
        target: STATUS_CHANNEL,
        time: this.tags?.time ?? new Date().toISOString(),
        category: MessageCategory.info,
        color: MessageColor.info,
      });
    }
  };

  // :server 606 yournick :nick1 nick2 nick3
  private readonly onRaw606 = (): void => {
    const myNick = this.line.shift();
    const nicks = this.line.join(' ').replace(/^:/, '');
    // Watch list entries
    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.watchlist', { nicks, defaultValue: `Watch list: ${nicks}` }),
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 607 yournick :End of WATCH list
  private readonly onRaw607 = (): void => {
    // End of watch list - nothing specific to do
  };

  // :server 608 yournick :Watch list cleared
  private readonly onRaw608 = (): void => {
    const myNick = this.line.shift();
    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.watchcleared', { defaultValue: 'Watch list cleared' }),
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 609 yournick nick ident host timestamp :is away
  private readonly onRaw609 = (): void => {
    const myNick = this.line.shift();
    const nick = this.line.shift();
    // User is currently away (when adding to watch list)
    if (nick) {
      setAddMessage({
        id: this.tags?.msgid ?? uuidv4(),
        message: i18next.t('kernel.watchaway', { nick, defaultValue: `${nick} is now away` }),
        target: STATUS_CHANNEL,
        time: this.tags?.time ?? new Date().toISOString(),
        category: MessageCategory.info,
        color: MessageColor.info,
      });
    }
  };

  // :server 704 mynick topic :help text start
  private readonly onRaw704 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const topic = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `[${topic}] ${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 705 mynick topic :help text line
  private readonly onRaw705 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const topic = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 706 mynick topic :End of /HELP
  private readonly onRaw706 = (): void => {
    const currentChannelName = getCurrentChannelName();
    const myNick = this.line.shift();
    const topic = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: `[${topic}] ${message}`,
      target: currentChannelName,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 728 mynick #channel q mask setter timestamp
  private readonly onRaw728 = (): void => {
    const myNick = this.line.shift();
    const channel = this.line.shift();
    const mode = this.line.shift(); // usually 'q' for quiet
    const mask = this.line.shift();
    const setBy = this.line.shift() ?? '';
    const setTime = Number(this.line.shift() ?? '0');

    if (channel === undefined || mask === undefined) {
      return;
    }

    // For channel settings quiet list (if supported)
    const settingsChannel = useChannelSettingsStore.getState().channelName;
    if (settingsChannel === channel) {
      // Could add to a quiet list in channel settings if implemented
    }

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.728', { channel, mask, setBy, defaultValue: `${channel} quiet: ${mask} (set by ${setBy})` }),
      target: channel,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };

  // :server 729 mynick #channel q :End of Channel Quiet List
  private readonly onRaw729 = (): void => {
    const myNick = this.line.shift();
    const channel = this.line.shift();
    const mode = this.line.shift();
    // End of quiet list - nothing specific to do
  };

  // :server 908 mynick PLAIN,EXTERNAL :are available SASL mechanisms
  private readonly onRaw908 = (): void => {
    const myNick = this.line.shift();
    const mechanisms = this.line.shift();
    const message = this.line.join(' ').replace(/^:/, '');

    setAddMessage({
      id: this.tags?.msgid ?? uuidv4(),
      message: i18next.t('kernel.908', { mechanisms, defaultValue: `Available SASL mechanisms: ${mechanisms}` }),
      target: STATUS_CHANNEL,
      time: this.tags?.time ?? new Date().toISOString(),
      category: MessageCategory.info,
      color: MessageColor.info,
    });
  };
}
