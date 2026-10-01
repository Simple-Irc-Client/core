import { defaultChannelTypes, STATUS_CHANNEL } from '@/config/config';
import { MessageColor } from '@/config/theme';
import { parseChannelModes, parseUserModes } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { ircSendNamesXProto } from '@/network/irc/network';
import { setAddMessage } from '@features/channels/store/channels';
import { setCaseMapping, setChannelModes, setChannelTypes, setLineLenLimit, setMonitorLimit, setNetworkName, setNickLenLimit, setSilenceLimit, setSupportedOption, setUserModes, setWatchLimit } from '@features/settings/store/settings';
import { parseCaseMapping } from '@shared/lib/caseMapping';
import { MessageCategory } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

const RPL_ISUPPORT = '005';

/** ISUPPORT list limits (MONITOR, WATCH, SILENCE): a token without a value means no limit. */
const parseIsupportLimit = (value: string | undefined): number =>
  value ? Number.parseInt(value, 10) : Number.POSITIVE_INFINITY;

// :netsplit.pirc.pl 005 SIC-test AWAYLEN=307 BOT=B CASEMAPPING=ascii CHANLIMIT=#:30 CHANMODES=beI,fkL,lH,cdimnprstzBCDGKMNOPQRSTVZ CHANNELLEN=32 CHANTYPES=# CHATHISTORY=50 CLIENTTAGDENY=*,-draft/typing,-typing,-draft/reply DEAF=d ELIST=MNUCT EXCEPTS :are supported by this server
// :netsplit.pirc.pl 005 SIC-test EXTBAN=~,acfjmnpqrtCGIOST EXTJWT=1 INVEX KICKLEN=307 KNOCK MAP MAXCHANNELS=30 MAXLIST=b:200,e:200,I:200 MAXNICKLEN=30 METADATA=10 MINNICKLEN=0 MODES=12 :are supported by this server
// :netsplit.pirc.pl 005 SIC-test MONITOR=128 NAMELEN=50 NAMESX NETWORK=pirc.pl NICKLEN=30 PREFIX=(qaohv)~&@%+ QUITLEN=307 SAFELIST SILENCE=15 STATUSMSG=~&@%+ TARGMAX=DCCALLOW:,ISON:,JOIN:,KICK:4,KILL:,LIST:,NAMES:1,NOTICE:1,PART:,PRIVMSG:4,SAJOIN:,SAPART:,TAGMSG:1,USERHOST:,USERIP:,WATCH:,WHOIS:1,WHOWAS:1 TOPICLEN=360 :are supported by this server
// :netsplit.pirc.pl 005 SIC-test UHNAMES USERIP WALLCHOPS WATCH=128 WATCHOPTS=A WHOX :are supported by this server
export const onRaw005 = (ctx: IrcContext): void => {
  ctx.line.shift(); // my nick

  setAddMessage({
    id: ctx.tags.msgid ?? uuidv4(),
    message: ctx.line.join(' '),
    target: STATUS_CHANNEL,
    time: ctx.tags.time ?? new Date().toISOString(),
    category: MessageCategory.info,
    color: MessageColor.info,
  });

  for (const parameter of ctx.line) {
    if (parameter.startsWith(':')) {
      break; // ":are supported by this server"
    }

    const [key, value] = parameter.split('=');
    switch (key) {
      case 'CHANTYPES':
        setChannelTypes(value !== undefined ? value.split('') : defaultChannelTypes);
        break;
      case 'CASEMAPPING':
        setCaseMapping(parseCaseMapping(value));
        break;
      case 'PREFIX':
        setUserModes(parseUserModes(value));
        break;
      case 'WHOX':
        setSupportedOption('WHOX');
        break;
      case 'NAMESX':
        setSupportedOption('NAMESX');
        ircSendNamesXProto();
        break;
      case 'CHANMODES':
        setChannelModes(parseChannelModes(value));
        break;
      case 'WATCH':
        setWatchLimit(parseIsupportLimit(value));
        break;
      case 'MONITOR':
        setMonitorLimit(parseIsupportLimit(value));
        break;
      case 'SILENCE':
        setSilenceLimit(parseIsupportLimit(value));
        break;
      case 'NICKLEN':
        setNickLenLimit(value !== undefined ? Number.parseInt(value, 10) : 50);
        break;
      case 'LINELEN':
        // 0 = not sent; E2EE chunking then uses a conservative default
        setLineLenLimit(value !== undefined ? Number.parseInt(value, 10) : 0);
        break;
      case 'NETWORK':
        if (value !== undefined) { setNetworkName(value); }
        break;
    }
  }
};

export const handlers: IrcHandlers = {
  [RPL_ISUPPORT]: onRaw005,
};
