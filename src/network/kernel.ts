/* eslint-disable @typescript-eslint/no-unused-vars */
import { type ChannelsStore } from '../store/channels'
import { type ChannelListStore } from '../store/channelsList'
import { type SettingsStore } from '../store/settings'
import { type UsersStore } from '../store/users'
import { ChannelCategory, MessageCategory } from '../types'
import { parseIrcRawMessage, parseNick } from './helpers'
import { ircRequestAvatar, ircSendList } from './network'

export interface IrcEvent {
  type: string
  line?: string
}

export const kernel = (
  settingsStore: SettingsStore,
  channelsStore: ChannelsStore,
  channelListStore: ChannelListStore,
  usersStore: UsersStore,
  event: IrcEvent
): void => {
  switch (event.type) {
    case 'connected':
      handleConnected(settingsStore, channelsStore)
      break
    case 'raw':
      if (event?.line !== undefined) {
        handleRaw(
          settingsStore,
          channelsStore,
          channelListStore,
          usersStore,
          event.line
        )
      }
      break
  }
}

const handleConnected = (
  settingsStore: SettingsStore,
  channelsStore: ChannelsStore
): void => {
  settingsStore.setIsConnected(true)
  settingsStore.setConnectedTime(Math.floor(Date.now() / 1000))

  channelsStore.setAddChannel('Debug', ChannelCategory.debug)
  channelsStore.setAddChannel('Status', ChannelCategory.status)

  settingsStore.setCurrentChannelName('Status', ChannelCategory.status)

  ircSendList()
}

const handleRaw = (
  settingsStore: SettingsStore,
  channelsStore: ChannelsStore,
  channelListStore: ChannelListStore,
  usersStore: UsersStore,
  event: string
): void => {
  const { tags, sender, command, line } = parseIrcRawMessage(event)

  switch (command) {
    case '001':
      onRaw001()
      break
    case '002':
      onRaw002()
      break
    case '003':
      onRaw003()
      break
    case '004':
      onRaw004()
      break
    case '005':
      onRaw005()
      break
    case '321':
      onRaw321(settingsStore, channelListStore)
      break
    case '322':
      onRaw322(settingsStore, channelListStore, line)
      break
    case '323':
      onRaw323(channelListStore)
      break
    case '332':
      onRaw332(channelsStore, line)
      break
    case '333':
      onRaw333(channelsStore, line)
      break
    case '353':
      onRaw353(usersStore, line)
      break
    case 'NOTICE':
      onNotice(settingsStore, tags, sender, command, line)
      break
    case 'NICK':
      onNick(settingsStore, usersStore, tags, sender, command, line)
      break
    case 'JOIN':
      onJoin(
        settingsStore,
        channelsStore,
        usersStore,
        tags,
        sender,
        command,
        line
      )
      break
    case 'PRIVMSG':
      onPrivmsg(
        settingsStore,
        channelsStore,
        usersStore,
        tags,
        sender,
        command,
        line
      )
      break
    default:
      // console.log(`unknown raw: ${line.join(" ")}`);
      break
  }

  // TODO
  // insomnia.pirc.pl 432 * Merovingian :Nickname is unavailable: Being held for registered user
  // ERROR :Closing Link: [1.1.1.1] (Registration Timeout)
  // @msgid=OzlbgBf04QlrtVm1hk02Jq;time=2023-02-04T23:17:18.121Z :Merovingian NICK :Niezident17561
  // :legowisko.pirc.pl 761 dsfsdfdsfdsfsdfdsfdsf Merovingian Avatar * :https://www.gravatar.com/avatar/8fadd198f40929e83421dd81e36f5637.jpg
  // :netsplit.pirc.pl BATCH +0G9Zyu0qr7Jem5SdPufanF chathistory #sic
  // :netsplit.pirc.pl BATCH -0G9Zyu0qr7Jem5SdPufanF
}

// :netsplit.pirc.pl 001 SIC-test :Welcome to the pirc.pl IRC Network SIC-test!~SIC-test@1.1.1.1
const onRaw001 = (): void => {
  //
}

// :netsplit.pirc.pl 002 SIC-test :Your host is netsplit.pirc.pl, running version UnrealIRCd-6.0.3
const onRaw002 = (): void => {
  //
}

// :netsplit.pirc.pl 003 SIC-test :This server was created Sun May 8 2022 at 13:49:18 UTC
const onRaw003 = (): void => {
  //
}

// :netsplit.pirc.pl 004 SIC-test netsplit.pirc.pl UnrealIRCd-6.0.3 diknopqrstwxzBDFGHINRSTWZ beIacdfhiklmnopqrstvzBCDGHKLMNOPQRSTVZ
const onRaw004 = (): void => {
  //
}

// :netsplit.pirc.pl 005 SIC-test AWAYLEN=307 BOT=B CASEMAPPING=ascii CHANLIMIT=#:30 CHANMODES=beI,fkL,lH,cdimnprstzBCDGKMNOPQRSTVZ CHANNELLEN=32 CHANTYPES=# CHATHISTORY=50 CLIENTTAGDENY=*,-draft/typing,-typing,-draft/reply DEAF=d ELIST=MNUCT EXCEPTS :are supported by this server
// :netsplit.pirc.pl 005 SIC-test EXTBAN=~,acfjmnpqrtCGIOST EXTJWT=1 INVEX KICKLEN=307 KNOCK MAP MAXCHANNELS=30 MAXLIST=b:200,e:200,I:200 MAXNICKLEN=30 METADATA=10 MINNICKLEN=0 MODES=12 :are supported by this server
// :netsplit.pirc.pl 005 SIC-test MONITOR=128 NAMELEN=50 NAMESX NETWORK=pirc.pl NICKLEN=30 PREFIX=(qaohv)~&@%+ QUITLEN=307 SAFELIST SILENCE=15 STATUSMSG=~&@%+ TARGMAX=DCCALLOW:,ISON:,JOIN:,KICK:4,KILL:,LIST:,NAMES:1,NOTICE:1,PART:,PRIVMSG:4,SAJOIN:,SAPART:,TAGMSG:1,USERHOST:,USERIP:,WATCH:,WHOIS:1,WHOWAS:1 TOPICLEN=360 :are supported by this server
// :netsplit.pirc.pl 005 SIC-test UHNAMES USERIP WALLCHOPS WATCH=128 WATCHOPTS=A WHOX :are supported by this server
const onRaw005 = (): void => {
  //
}

// :insomnia.pirc.pl 321 dsfdsfdsfsdfdsfsdfaas Channel :Users  Name
const onRaw321 = (
  settingsStore: SettingsStore,
  channelListStore: ChannelListStore
): void => {
  channelListStore.setClearList()
}

// :insomnia.pirc.pl 322 dsfdsfdsfsdfdsfsdfaas #Base 1 :[+nt]
const onRaw322 = (
  settingsStore: SettingsStore,
  channelListStore: ChannelListStore,
  line: string[]
): void => {
  const sender = line.shift()

  const name = line.shift() ?? ''
  const users = Number(line.shift() ?? '0')
  const topic = line.join(' ')?.substring(1)

  channelListStore.setAddChannel(name, users, topic)
}

// :insomnia.pirc.pl 323 dsfdsfdsfsdfdsfsdfaas :End of /LIST
const onRaw323 = (channelListStore: ChannelListStore): void => {
  channelListStore.setFinished(true)
}

// :chmurka.pirc.pl 332 SIC-test #sic :Prace nad Simple Irc Client trwają
const onRaw332 = (channelsStore: ChannelsStore, line: string[]): void => {
  const nick = line.shift()
  const channel = line.shift()
  const topic = line.join(' ')?.substring(1)

  if (channel === undefined) {
    console.warn('RAW 332 - warning - cannot read channel')
    return
  }

  channelsStore.setTopic(channel, topic)
}

// :chmurka.pirc.pl 333 SIC-test #sic Merovingian 1552692216
const onRaw333 = (channelsStore: ChannelsStore, line: string[]): void => {
  const currentUser = line.shift()
  const channel = line.shift()
  const setBy = line.shift()
  const setTime = Number(line.shift() ?? '0')

  if (channel === undefined || setBy === undefined) {
    console.warn('RAW 333 - warning - cannot read channel or setBy')
    return
  }

  channelsStore.setTopicSetBy(channel, setBy, setTime)
}

// :chmurka.pirc.pl 353 SIC-test = #sic :SIC-test!~SIC-test@D6D788C7.623ED634.C8132F93.IP @Noop!~Noop@AB43659:6EA4AE53:B58B785A:IP
const onRaw353 = (usersStore: UsersStore, line: string[]): void => {
  const currentUser = line.shift()
  const flags = line.shift()
  const channel = line.shift()

  if (channel === undefined) {
    console.warn('RAW 353 - warning - cannot read channel')
    return
  }

  for (let user of line) {
    if (user.startsWith(':')) {
      user = user.substring(1)
    }

    const { nick, ident, hostname } = parseNick(user)

    if (usersStore.getHasUser(nick)) {
      usersStore.setJoinUser(nick, channel)
    } else {
      usersStore.setAddUser({
        nick,
        ident,
        hostname,
        avatarUrl: '',
        modes: [], // TODO
        maxMode: 0, // TODO
        channels: [channel]
      })

      ircRequestAvatar(nick)
    }
  }
}

// :netsplit.pirc.pl NOTICE * :*** No ident response; username prefixed with ~
// @draft/bot;msgid=hjeGCPN39ksrHai7Rs5gda;time=2023-02-04T22:48:46.472Z :NickServ!NickServ@serwisy.pirc.pl NOTICE ghfghfghfghfghfgh :Twój nick nie jest zarejestrowany. Aby dowiedzieć się, jak go zarejestrować i po co, zajrzyj na https://pirc.pl/serwisy/nickserv/
const onNotice = (
  settingsStore: SettingsStore,
  tags: string,
  sender: string,
  command: string,
  line: string[]
): void => {
  const passwordRequired =
    /^(This nickname is registered and protected|Ten nick jest zarejestrowany i chroniony).*/

  const list =
    /.*You have to be connected for at least (\d+) seconds before being able to \/LIST, please ignore the fake output above.*/

  const target = line.shift()

  let message = line.join(' ')
  if (message.at(0) === ':') {
    message = message.substring(1)
  }

  if (
    sender.startsWith('NickServ!NickServ@') &&
    target === settingsStore.nick &&
    passwordRequired.test(message)
  ) {
    settingsStore.setIsPasswordRequired(true)
  }

  if (target === settingsStore.nick && list.test(message)) {
    const seconds = list.exec(message)?.[1]
    if (seconds !== undefined && settingsStore.connectedTime !== 0) {
      const currentTime = Math.floor(Date.now() / 1000)
      const loggedTime = currentTime - settingsStore.connectedTime
      const remaining =
        loggedTime > Number(seconds) ? 0 : Number(seconds) - loggedTime

      setTimeout(() => {
        ircSendList()
      }, (remaining + 1) * 1000)
    }
  }
}

// @msgid=ls4nEYgZI42LXbsrfkcwcc;time=2023-02-12T14:20:53.072Z :Merovingian NICK :Niezident36707
const onNick = (
  settingsStore: SettingsStore,
  usersStore: UsersStore,
  tags: string,
  sender: string,
  command: string,
  line: string[]
): void => {
  const newNick = line.shift()?.substring(1)

  if (newNick === undefined) {
    console.warn('RAW NICK - warning - cannot read new nick')
    return
  }

  if (sender === settingsStore.nick) {
    // TODO message
    settingsStore.setNick(newNick)
  } else {
    usersStore.setRenameUser(sender, newNick)
  }
}
// @msgid=oXhSn3eP0x5LlSJTX2SxJj-NXV6407yG5qKZnAWemhyGQ;time=2023-02-11T20:42:11.830Z :SIC-test!~SIC-test@D6D788C7.623ED634.C8132F93.IP JOIN #sic * :Simple Irc Client user
const onJoin = (
  settingsStore: SettingsStore,
  channelsStore: ChannelsStore,
  usersStore: UsersStore,
  tags: string,
  sender: string,
  command: string,
  line: string[]
): void => {
  const channel = line.shift()
  const { nick, ident, hostname } = parseNick(sender)

  console.log(`JOIN nick ${nick}`)
  console.log(`JOIN ident ${ident}`)
  console.log(`JOIN hostname ${hostname}`)
  console.log(`JOIN settingsStore.nick ${settingsStore.nick}`)

  if (channel === undefined) {
    console.warn('RAW JOIN - warning - cannot read channel')
    return
  }

  if (nick === settingsStore.nick) {
    channelsStore.setAddChannel(channel, ChannelCategory.channel)
    settingsStore.setCurrentChannelName(channel, ChannelCategory.channel)
  } else {
    // TODO message joined

    channelsStore.setAddChannel(channel, ChannelCategory.channel)

    console.log(`JOIN usersStore.getHasUser ${usersStore.getHasUser(nick) ? 'true' : 'false'}`)

    if (usersStore.getHasUser(nick)) {
      usersStore.setJoinUser(nick, channel)
    } else {
      usersStore.setAddUser({
        nick,
        ident,
        hostname,
        avatarUrl: '',
        modes: [],
        maxMode: 0,
        channels: [channel]
      })

      ircRequestAvatar(nick)
    }
  }
}

// @batch=UEaMMV4PXL3ymLItBEAhBO;msgid=498xEffzvc3SBMJsRPQ5Iq;time=2023-02-12T02:06:12.210Z :SIC-test2!~mero@D6D788C7.623ED634.C8132F93.IP PRIVMSG #sic :test 1
// @msgid=HPS1IK0ruo8t691kVDRtFl;time=2023-02-12T02:11:26.770Z :SIC-test2!~mero@D6D788C7.623ED634.C8132F93.IP PRIVMSG #sic :test 4
const onPrivmsg = (
  settingsStore: SettingsStore,
  channelsStore: ChannelsStore,
  usersStore: UsersStore,
  tags: string,
  sender: string,
  command: string,
  line: string[]
): void => {
  const target = line.shift()
  const message = line.join(' ').substring(1)
  const { nick } = parseNick(sender)

  if (target === undefined) {
    console.warn('RAW PRIVMSG - warning - cannot read target')
    return
  }

  if (target === settingsStore.nick) {
    // TODO priv
  } else {
    if (target !== settingsStore.currentChannelName) {
      // TODO increment unread messages
    }

    const user = usersStore.getUser(nick)

    channelsStore.setAddMessage(target, {
      message,
      nick: user ?? nick,
      target,
      time: 0, // TODO
      category: MessageCategory.default
    })
  }
}
