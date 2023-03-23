/**
 * @vitest-environment node
 */
import { describe, expect, it, afterEach, vi } from 'vitest';
import { Kernel } from '../kernel';
import * as settingsFile from '../../store/settings';
import * as channelsFile from '../../store/channels';
import * as channelListFile from '../../store/channelList';
import * as usersFile from '../../store/users';
import * as networkFile from '../../network/network';
import i18next from '../../i18n';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '../../config/config';

describe('kernel tests', () => {
  const defaultUserModes = [
    { symbol: '~', mode: 'q' },
    { symbol: '&', mode: 'a' },
    { symbol: '@', mode: 'o' },
    { symbol: '%', mode: 'h' },
    { symbol: '+', mode: 'v' },
  ];

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('test connected', () => {
    const mockSetIsConnected = vi.spyOn(settingsFile, 'setIsConnected').mockImplementation(() => {});
    const mockSetConnectedTime = vi.spyOn(settingsFile, 'setConnectedTime').mockImplementation(() => {});
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});

    new Kernel().handle({ type: 'connected' });

    expect(mockSetIsConnected).toBeCalledWith(true);
    expect(mockSetConnectedTime).toBeCalledTimes(1);
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledWith(expect.objectContaining({ message: i18next.t('kernel.connected') }));
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledTimes(1);
  });

  it('test close', () => {
    const mockSetIsConnected = vi.spyOn(settingsFile, 'setIsConnected').mockImplementation(() => {});
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});

    new Kernel().handle({ type: 'close' });

    expect(mockSetIsConnected).toBeCalledWith(false);
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledWith(expect.objectContaining({ message: i18next.t('kernel.disconnected') }));
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledTimes(1);
  });

  it('test raw 001', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':netsplit.pirc.pl 001 SIC-test :Welcome to the pirc.pl IRC Network SIC-test!~SIC-test@1.1.1.1';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'Welcome to the pirc.pl IRC Network SIC-test!~SIC-test@1.1.1.1' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 002', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':netsplit.pirc.pl 002 SIC-test :Your host is netsplit.pirc.pl, running version UnrealIRCd-6.0.3';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'Your host is netsplit.pirc.pl, running version UnrealIRCd-6.0.3' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 003', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':netsplit.pirc.pl 003 SIC-test :This server was created Sun May 8 2022 at 13:49:18 UTC';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'This server was created Sun May 8 2022 at 13:49:18 UTC' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 004', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':netsplit.pirc.pl 004 SIC-test netsplit.pirc.pl UnrealIRCd-6.0.3 diknopqrstwxzBDFGHINRSTWZ beIacdfhiklmnopqrstvzBCDGHKLMNOPQRSTVZ';
    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        target: STATUS_CHANNEL,
        message: 'netsplit.pirc.pl UnrealIRCd-6.0.3 diknopqrstwxzBDFGHINRSTWZ beIacdfhiklmnopqrstvzBCDGHKLMNOPQRSTVZ',
      })
    );
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 005 chantypes', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const mockSetChannelTypes = vi.spyOn(settingsFile, 'setChannelTypes').mockImplementation(() => {});
    const mockSetNamesXProtoEnabled = vi.spyOn(settingsFile, 'setNamesXProtoEnabled').mockImplementation(() => {});
    const mockIrcSendNamesXProto = vi.spyOn(networkFile, 'ircSendNamesXProto').mockImplementation(() => {});

    const line =
      ':netsplit.pirc.pl 005 SIC-test AWAYLEN=307 BOT=B CASEMAPPING=ascii CHANLIMIT=#:30 CHANMODES=beI,fkL,lH,cdimnprstzBCDGKMNOPQRSTVZ CHANNELLEN=32 CHANTYPES=# CHATHISTORY=50 CLIENTTAGDENY=*,-draft/typing,-typing,-draft/reply DEAF=d ELIST=MNUCT EXCEPTS :are supported by this server';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetChannelTypes).toHaveBeenNthCalledWith(1, ['#']);

    expect(mockSetChannelTypes).toHaveBeenCalledTimes(1);
    expect(mockSetNamesXProtoEnabled).toHaveBeenCalledTimes(0);
    expect(mockIrcSendNamesXProto).toHaveBeenCalledTimes(0);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        target: STATUS_CHANNEL,
        message:
          'AWAYLEN=307 BOT=B CASEMAPPING=ascii CHANLIMIT=#:30 CHANMODES=beI,fkL,lH,cdimnprstzBCDGKMNOPQRSTVZ CHANNELLEN=32 CHANTYPES=# CHATHISTORY=50 CLIENTTAGDENY=*,-draft/typing,-typing,-draft/reply DEAF=d ELIST=MNUCT EXCEPTS :are supported by this server',
      })
    );
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 005 prefix', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const mockSetUserModes = vi.spyOn(settingsFile, 'setUserModes').mockImplementation(() => {});
    const mockSetNamesXProtoEnabled = vi.spyOn(settingsFile, 'setNamesXProtoEnabled').mockImplementation(() => {});
    const mockIrcSendNamesXProto = vi.spyOn(networkFile, 'ircSendNamesXProto').mockImplementation(() => {});

    const line =
      ':netsplit.pirc.pl 005 SIC-test MONITOR=128 NAMELEN=50 NAMESX NETWORK=pirc.pl NICKLEN=30 PREFIX=(qaohv)~&@%+ QUITLEN=307 SAFELIST SILENCE=15 STATUSMSG=~&@%+ TARGMAX=DCCALLOW:,ISON:,JOIN:,KICK:4,KILL:,LIST:,NAMES:1,NOTICE:1,PART:,PRIVMSG:4,SAJOIN:,SAPART:,TAGMSG:1,USERHOST:,USERIP:,WATCH:,WHOIS:1,WHOWAS:1 TOPICLEN=360 :are supported by this server';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetUserModes).toHaveBeenNthCalledWith(1, [
      { mode: 'q', symbol: '~' },
      { mode: 'a', symbol: '&' },
      { mode: 'o', symbol: '@' },
      { mode: 'h', symbol: '%' },
      { mode: 'v', symbol: '+' },
    ]);
    expect(mockSetUserModes).toHaveBeenCalledTimes(1);
    expect(mockSetNamesXProtoEnabled).toHaveBeenNthCalledWith(1, true);
    expect(mockIrcSendNamesXProto).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        target: STATUS_CHANNEL,
        message:
          'MONITOR=128 NAMELEN=50 NAMESX NETWORK=pirc.pl NICKLEN=30 PREFIX=(qaohv)~&@%+ QUITLEN=307 SAFELIST SILENCE=15 STATUSMSG=~&@%+ TARGMAX=DCCALLOW:,ISON:,JOIN:,KICK:4,KILL:,LIST:,NAMES:1,NOTICE:1,PART:,PRIVMSG:4,SAJOIN:,SAPART:,TAGMSG:1,USERHOST:,USERIP:,WATCH:,WHOIS:1,WHOWAS:1 TOPICLEN=360 :are supported by this server',
      })
    );
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 251', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':saturn.pirc.pl 251 SIC-test :There are 158 users and 113 invisible on 10 servers';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'There are 158 users and 113 invisible on 10 servers' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 252', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':saturn.pirc.pl 252 SIC-test 27 :operator(s) online';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: '27 :operator(s) online' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 253', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':saturn.pirc.pl 253 SIC-test -14 :unknown connection(s)';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: '-14 :unknown connection(s)' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 254', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':saturn.pirc.pl 254 SIC-test 185 :channels formed';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: '185 :channels formed' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 255', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':saturn.pirc.pl 255 SIC-test :I have 42 clients and 0 servers';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'I have 42 clients and 0 servers' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 265', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':saturn.pirc.pl 265 SIC-test 42 62 :Current local users 42, max 62';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'Current local users 42, max 62' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 266', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':saturn.pirc.pl 266 SIC-test 271 1721 :Current global users 271, max 1721';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'Current global users 271, max 1721' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 321', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetChannelListClear = vi.spyOn(channelListFile, 'setChannelListClear').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 321 dsfdsfdsfsdfdsfsdfaas Channel :Users  Name';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetChannelListClear).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 322 #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetAddChannelToList = vi.spyOn(channelListFile, 'setAddChannelToList').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 322 dsfdsfdsfsdfdsfsdfaas #Base 1 :[+nt]';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddChannelToList).toHaveBeenCalledWith('#Base', 1, '[+nt]');
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddChannelToList).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 322 #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetAddChannelToList = vi.spyOn(channelListFile, 'setAddChannelToList').mockImplementation(() => {});

    const line = ':netsplit.pirc.pl 322 sic-test * 1 :';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddChannelToList).toHaveBeenCalledWith('*', 1, '');
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddChannelToList).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 322 #3', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetAddChannelToList = vi.spyOn(channelListFile, 'setAddChannelToList').mockImplementation(() => {});

    const line = ':netsplit.pirc.pl 322 sic-test #+Kosciol+ 1 :[+nt]';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddChannelToList).toHaveBeenCalledWith('#+Kosciol+', 1, '[+nt]');
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddChannelToList).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 323', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetChannelListFinished = vi.spyOn(channelListFile, 'setChannelListFinished').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 323 dsfdsfdsfsdfdsfsdfaas :End of /LIST';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetChannelListFinished).toHaveBeenNthCalledWith(1, true);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetChannelListFinished).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 332', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetTopic = vi.spyOn(channelsFile, 'setTopic').mockImplementation(() => {});

    const line = ':chmurka.pirc.pl 332 SIC-test #sic :Prace nad Simple Irc Client trwają';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetTopic).toHaveBeenNthCalledWith(1, '#sic', 'Prace nad Simple Irc Client trwają');
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetTopic).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 333', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetTopicSetBy = vi.spyOn(channelsFile, 'setTopicSetBy').mockImplementation(() => {});

    const line = ':chmurka.pirc.pl 333 SIC-test #sic Merovingian 1552692216';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetTopicSetBy).toHaveBeenNthCalledWith(1, '#sic', 'Merovingian', 1552692216);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetTopicSetBy).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 353 #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockGetHasUser = vi.spyOn(usersFile, 'getHasUser').mockImplementation(() => false);
    const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => false);
    const mockIrcRequestMetadata = vi.spyOn(networkFile, 'ircRequestMetadata').mockImplementation(() => false);

    const line =
      ':chmurka.pirc.pl 353 sic-test = #Religie :aleksa7!~aleksa7@vhost:kohana.aleksia +Alisha!~user@397FF66D:D8E4ABEE:5838DA6D:IP +ProrokCodzienny!~ProrokCod@AB43659:6EA4AE53:B58B785A:IP &@Pomocnik!pomocny@bot:kanalowy.pomocnik';

    new Kernel().handle({ type: 'raw', line });

    expect(mockGetUserModes).toHaveBeenCalledTimes(4);
    expect(mockGetHasUser).toHaveBeenCalledTimes(4);
    expect(mockSetAddUser).toHaveBeenCalledTimes(4);
    expect(mockSetAddUser).toHaveBeenNthCalledWith(1, {
      channels: ['#Religie'],
      hostname: 'vhost:kohana.aleksia',
      ident: '~aleksa7',
      maxMode: -1,
      modes: [],
      nick: 'aleksa7',
    });
    expect(mockSetAddUser).toHaveBeenNthCalledWith(2, {
      channels: ['#Religie'],
      hostname: '397FF66D:D8E4ABEE:5838DA6D:IP',
      ident: '~user',
      maxMode: 252,
      modes: ['v'],
      nick: 'Alisha',
    });
    expect(mockSetAddUser).toHaveBeenNthCalledWith(3, {
      channels: ['#Religie'],
      hostname: 'AB43659:6EA4AE53:B58B785A:IP',
      ident: '~ProrokCod',
      maxMode: 252,
      modes: ['v'],
      nick: 'ProrokCodzienny',
    });
    expect(mockSetAddUser).toHaveBeenNthCalledWith(4, {
      channels: ['#Religie'],
      hostname: 'bot:kanalowy.pomocnik',
      ident: 'pomocny',
      maxMode: 255,
      modes: ['a', 'o'],
      nick: 'Pomocnik',
    });
    expect(mockIrcRequestMetadata).toHaveBeenCalledTimes(4);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 353 #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockGetHasUser = vi.spyOn(usersFile, 'getHasUser').mockImplementation(() => true);
    const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => false);
    const mockIrcRequestMetadata = vi.spyOn(networkFile, 'ircRequestMetadata').mockImplementation(() => false);
    const mockSetJoinUser = vi.spyOn(usersFile, 'setJoinUser').mockImplementation(() => {});

    const line = ':chmurka.pirc.pl 353 sic-test = #Religie :aleksa7!~aleksa7@vhost:kohana.aleksia';

    new Kernel().handle({ type: 'raw', line });

    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockGetHasUser).toHaveBeenCalledTimes(1);
    expect(mockSetAddUser).toHaveBeenCalledTimes(0);
    expect(mockSetJoinUser).toHaveBeenNthCalledWith(1, 'aleksa7', '#Religie');
    expect(mockIrcRequestMetadata).toHaveBeenCalledTimes(0);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 366', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':bzyk.pirc.pl 366 SIC-test #sic :End of /NAMES list.';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 372', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':saturn.pirc.pl 372 SIC-test :- 2/6/2022 11:27';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: '- 2/6/2022 11:27' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 375', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':saturn.pirc.pl 375 SIC-test :- saturn.pirc.pl Message of the Day -';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: '- saturn.pirc.pl Message of the Day -' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 376', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':saturn.pirc.pl 376 SIC-test :End of /MOTD command.';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'End of /MOTD command.' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 396', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':chmurka.pirc.pl 396 sic-test A.A.A.IP :is now your displayed host';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'A.A.A.IP :is now your displayed host' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 761', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetUserAvatar = vi.spyOn(usersFile, 'setUserAvatar').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 761 SIC-test Merovingian Avatar * :https://www.gravatar.com/avatar/8fadd198f40929e83421dd81e36f5637.jpg';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetUserAvatar).toHaveBeenCalledWith('Merovingian', 'https://www.gravatar.com/avatar/8fadd198f40929e83421dd81e36f5637.jpg');
    expect(mockSetUserAvatar).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 762', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':chmurka.pirc.pl 762 SIC-test :end of metadata';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 766', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl 766 SIC-test SIC-test Avatar :no matching key';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw ERROR', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    const mockGetIsCreatorCompleted = vi.spyOn(settingsFile, 'getIsCreatorCompleted').mockImplementation(() => true);

    const line = 'ERROR :Closing Link: [1.1.1.1] (Registration Timeout)';

    new Kernel().handle({ type: 'raw', line });

    expect(mockGetIsCreatorCompleted).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledWith(expect.objectContaining({ message: 'Closing Link: [1.1.1.1] (Registration Timeout)' }));
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledTimes(1);
  });

  it('test raw BATCH', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = ':netsplit.pirc.pl BATCH +0G9Zyu0qr7Jem5SdPufanF chathistory #sic';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw PONG', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const line = '@msgid=MIikH9lopbKqOQpz8ADjfP;time=2023-03-20T23:07:21.701Z :chmurka.pirc.pl PONG chmurka.pirc.pl :1679353641686';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw NOTICE #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);

    const line = '@draft/bot;msgid=mcOQVkbTRyuCcC0Rso27IB;time=2023-02-22T00:20:59.308Z :Pomocnik!pomocny@bot:kanalowy.pomocnik NOTICE mero-test :[#religie] Dla trolli są inne kanały...';

    new Kernel().handle({ type: 'raw', line });

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: '[#religie] Dla trolli są inne kanały...' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw NOTICE #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockSetIsPasswordRequired = vi.spyOn(settingsFile, 'setIsPasswordRequired').mockImplementation(() => {});
    const mockSetSetCreatorStep = vi.spyOn(settingsFile, 'setCreatorStep').mockImplementation(() => {});

    const line =
      '@draft/bot;msgid=hjeGCPN39ksrHai7Rs5gda;time=2023-02-04T22:48:46.472Z :NickServ!NickServ@serwisy.pirc.pl NOTICE SIC-test :Ten nick jest zarejestrowany i chroniony. Jeśli należy do Ciebie,';

    new Kernel().handle({ type: 'raw', line });

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);

    expect(mockSetIsPasswordRequired).toHaveBeenCalledTimes(1);
    expect(mockSetIsPasswordRequired).toHaveBeenCalledWith(true);

    expect(mockSetSetCreatorStep).toHaveBeenCalledTimes(1);
    expect(mockSetSetCreatorStep).toHaveBeenCalledWith('password');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#current-channel', message: 'Ten nick jest zarejestrowany i chroniony. Jeśli należy do Ciebie,' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw NOTICE #3', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockGetIsCreatorCompleted = vi.spyOn(settingsFile, 'getIsCreatorCompleted').mockImplementation(() => false);
    const mockGetConnectedTime = vi.spyOn(settingsFile, 'getConnectedTime').mockImplementation(() => Math.floor(Date.now() / 1000) - 5);
    const mockSetListRequestRemainingSeconds = vi.spyOn(settingsFile, 'setListRequestRemainingSeconds').mockImplementation(() => {});

    const line = ':insomnia.pirc.pl NOTICE SIC-test :You have to be connected for at least 20 seconds before being able to /LIST, please ignore the fake output above';

    new Kernel().handle({ type: 'raw', line });

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);

    expect(mockGetIsCreatorCompleted).toHaveBeenCalledTimes(1);

    expect(mockGetConnectedTime).toHaveBeenCalledTimes(1);

    expect(mockSetListRequestRemainingSeconds).toHaveBeenCalledTimes(1);
    expect(mockSetListRequestRemainingSeconds).toHaveBeenCalledWith(15);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw NICK #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockSetRenameUser = vi.spyOn(usersFile, 'setRenameUser').mockImplementation(() => {});
    const mockGetUserChannels = vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => ['#channel1', '#channel2']);

    const line = '@msgid=ls4nEYgZI42LXbsrfkcwcc;time=2023-02-12T14:20:53.072Z :Merovingian NICK :Niezident36707';

    new Kernel().handle({ type: 'raw', line });

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);

    expect(mockGetUserChannels).toHaveBeenCalledTimes(1);
    expect(mockGetUserChannels).toHaveBeenCalledWith('Merovingian');

    expect(mockSetRenameUser).toHaveBeenCalledTimes(1);
    expect(mockSetRenameUser).toHaveBeenCalledWith('Merovingian', 'Niezident36707');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#channel1', message: 'Merovingian zmienił nick na Niezident36707' }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(3, expect.objectContaining({ target: '#channel2', message: 'Merovingian zmienił nick na Niezident36707' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(3);
  });

  it('test raw NICK #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#current-channel');
    const mockSetRenameUser = vi.spyOn(usersFile, 'setRenameUser').mockImplementation(() => {});
    const mockSetNick = vi.spyOn(settingsFile, 'setNick').mockImplementation(() => {});
    const mockGetUserChannels = vi.spyOn(usersFile, 'getUserChannels').mockImplementation(() => ['#channel1', '#channel2']);

    const line = '@msgid=ls4nEYgZI42LXbsrfkcwcc;time=2023-02-12T14:20:53.072Z :SIC-test NICK :Niezident36707';

    new Kernel().handle({ type: 'raw', line });

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);
    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);

    expect(mockGetUserChannels).toHaveBeenCalledTimes(1);
    expect(mockGetUserChannels).toHaveBeenNthCalledWith(1, 'SIC-test');

    expect(mockSetRenameUser).toHaveBeenCalledTimes(1);
    expect(mockSetRenameUser).toHaveBeenNthCalledWith(1, 'SIC-test', 'Niezident36707');

    expect(mockSetNick).toHaveBeenCalledTimes(1);
    expect(mockSetNick).toHaveBeenCalledWith('Niezident36707');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#channel1', message: 'SIC-test zmienił nick na Niezident36707' }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(3, expect.objectContaining({ target: '#channel2', message: 'SIC-test zmienił nick na Niezident36707' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(3);
  });

  it('test raw JOIN #1 self', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC-test');
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
    const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
    const mockIsMetadataEnabled = vi.spyOn(settingsFile, 'isMetadataEnabled').mockImplementation(() => true);
    const mockIrcRequestMetadata = vi.spyOn(networkFile, 'ircRequestMetadata').mockImplementation(() => {});

    const line = '@msgid=oXhSn3eP0x5LlSJTX2SxJj-NXV6407yG5qKZnAWemhyGQ;time=2023-02-11T20:42:11.830Z :SIC-test!~SIC-test@D6D788C7.623ED634.C8132F93.IP JOIN #channel1 * :Simple Irc Client user';

    new Kernel().handle({ type: 'raw', line });

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledTimes(1);

    expect(mockSetAddUser).toHaveBeenCalledTimes(0);
    expect(mockIsMetadataEnabled).toHaveBeenCalledTimes(0);
    expect(mockIrcRequestMetadata).toHaveBeenCalledTimes(0);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#channel1', message: 'SIC-test dołączył do kanału' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw JOIN #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC');
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
    const mockSetAddUser = vi.spyOn(usersFile, 'setAddUser').mockImplementation(() => {});
    const mockIsMetadataEnabled = vi.spyOn(settingsFile, 'isMetadataEnabled').mockImplementation(() => true);
    const mockIrcRequestMetadata = vi.spyOn(networkFile, 'ircRequestMetadata').mockImplementation(() => {});

    const line = '@msgid=oXhSn3eP0x5LlSJTX2SxJj-NXV6407yG5qKZnAWemhyGQ;time=2023-02-11T20:42:11.830Z :SIC-test!~SIC-test@D6D788C7.623ED634.C8132F93.IP JOIN #channel1 * :Simple Irc Client user';

    new Kernel().handle({ type: 'raw', line });

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);
    expect(mockGetUserModes).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledTimes(0);

    expect(mockSetAddUser).toHaveBeenCalledTimes(1);
    expect(mockIsMetadataEnabled).toHaveBeenCalledTimes(1);
    expect(mockIrcRequestMetadata).toHaveBeenCalledWith('SIC-test');
    expect(mockIrcRequestMetadata).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#channel1', message: 'SIC-test dołączył do kanału' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw PART #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'SIC');
    const mockSetRemoveUser = vi.spyOn(usersFile, 'setRemoveUser').mockImplementation(() => {});
    const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});

    const line = '@account=Merovingian;msgid=hXPXorNkRXTwVOTU1RbpXN-0D/dV2/Monv6zuHQw/QAGw;time=2023-02-12T22:44:07.583Z :Merovingian!~pirc@cloak:Merovingian PART #sic :Opuścił kanał';

    new Kernel().handle({ type: 'raw', line });

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledTimes(0);

    expect(mockSetRemoveUser).toHaveBeenCalledTimes(1);
    expect(mockSetRemoveUser).toHaveBeenCalledWith('Merovingian', '#sic');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#sic', message: 'Merovingian opuścił kanał (Opuścił kanał)' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw PART #2 self', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'Merovingian');
    const mockSetRemoveUser = vi.spyOn(usersFile, 'setRemoveUser').mockImplementation(() => {});
    const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
    const mockSetRemoveChannel = vi.spyOn(channelsFile, 'setRemoveChannel').mockImplementation(() => {});

    const line = '@account=Merovingian;msgid=hXPXorNkRXTwVOTU1RbpXN-0D/dV2/Monv6zuHQw/QAGw;time=2023-02-12T22:44:07.583Z :Merovingian!~pirc@cloak:Merovingian PART #sic :Opuścił kanał';

    new Kernel().handle({ type: 'raw', line });

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledTimes(1);

    expect(mockSetRemoveUser).toHaveBeenCalledTimes(1);
    expect(mockSetRemoveUser).toHaveBeenCalledWith('Merovingian', '#sic');

    expect(mockSetRemoveChannel).toHaveBeenCalledTimes(1);
    expect(mockSetRemoveChannel).toHaveBeenCalledWith('#sic');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#sic', message: 'Merovingian opuścił kanał (Opuścił kanał)' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw KICK #1', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'test-user');
    const mockSetRemoveUser = vi.spyOn(usersFile, 'setRemoveUser').mockImplementation(() => {});
    const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});

    const line = '@account=ratler__;msgid=qDtfbJQ2Ym74HmVRslOgeZ-mLABGCzcOme4EdMIqCME+A;time=2023-03-20T21:23:29.512Z :ratler__!~pirc@vhost:ratler.ratler KICK #Religie sic-test :ratler__';

    new Kernel().handle({ type: 'raw', line });

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledTimes(0);

    expect(mockSetRemoveUser).toHaveBeenCalledTimes(1);
    expect(mockSetRemoveUser).toHaveBeenCalledWith('sic-test', '#Religie');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#Religie', message: 'sic-test został wyrzucony przez ratler__ (ratler__)' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw KICK #2 self', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentNick = vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'sic-test');
    const mockSetRemoveUser = vi.spyOn(usersFile, 'setRemoveUser').mockImplementation(() => {});
    const mockSetCurrentChannelName = vi.spyOn(settingsFile, 'setCurrentChannelName').mockImplementation(() => {});
    const mockSetRemoveChannel = vi.spyOn(channelsFile, 'setRemoveChannel').mockImplementation(() => {});

    const line = '@account=ratler__;msgid=qDtfbJQ2Ym74HmVRslOgeZ-mLABGCzcOme4EdMIqCME+A;time=2023-03-20T21:23:29.512Z :ratler__!~pirc@vhost:ratler.ratler KICK #Religie sic-test :ratler__';

    new Kernel().handle({ type: 'raw', line });

    expect(mockGetCurrentNick).toHaveBeenCalledTimes(1);
    expect(mockSetCurrentChannelName).toHaveBeenCalledTimes(1);

    expect(mockSetRemoveUser).toHaveBeenCalledTimes(1);
    expect(mockSetRemoveUser).toHaveBeenCalledWith('sic-test', '#Religie');

    expect(mockSetRemoveChannel).toHaveBeenCalledTimes(1);
    expect(mockSetRemoveChannel).toHaveBeenCalledWith('#Religie');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: STATUS_CHANNEL, message: 'Zostałeś wyrzucony z #Religie przez ratler__ (ratler__)' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw QUIT', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetQuitUser = vi.spyOn(usersFile, 'setQuitUser').mockImplementation(() => {});

    const line = '@msgid=aGJTRBjAMOMRB6Ky2ucXbV-Gved4HyF6QNSHYfzOX1jOA;time=2023-03-11T00:52:21.568Z :mero!~mero@D6D788C7.623ED634.C8132F93.IP QUIT :Quit: Leaving';

    new Kernel().handle({ type: 'raw', line });

    expect(mockSetQuitUser).toHaveBeenCalledTimes(1);
    expect(mockSetQuitUser).toHaveBeenCalledWith('mero', expect.objectContaining({ message: 'mero opuścił serwer (Quit: Leaving)' }));

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw INVITE', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetCurrentChannelName = vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#channel1');

    const line = '@msgid=WglKE4an4Y6MGcC9tVM7jV;time=2023-03-23T00:58:29.305Z :mero!~mero@D6D788C7.623ED634.C8132F93.IP INVITE sic-test :#sic';

    new Kernel().handle({ type: 'raw', line });

    expect(mockGetCurrentChannelName).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#channel1', message: 'mero zaprasza do kanału: #sic' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw KILL', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetAddMessageToAllChannels = vi.spyOn(channelsFile, 'setAddMessageToAllChannels').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);

    const line = ':server KILL scc_test :Killed (Nickname collision)';

    new Kernel().handle({ type: 'raw', line });

    expect(mockGetUserModes).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);

    expect(mockSetAddMessageToAllChannels).toHaveBeenNthCalledWith(1, expect.objectContaining({ message: 'Zostałeś rozłączony z serwera przez server (Killed (Nickname collision))' }));
    expect(mockSetAddMessageToAllChannels).toHaveBeenCalledTimes(1);
  });

  // TODO mode

  it('test raw TOPIC', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    const mockSetTopic = vi.spyOn(channelsFile, 'setTopic').mockImplementation(() => {});

    const line = '@account=Merovingian;msgid=33x8Q9DP1OpJVeJe3S7usg;time=2023-03-23T00:04:18.011Z :Merovingian!~pirc@cloak:Merovingian TOPIC #sic :Test 1';

    new Kernel().handle({ type: 'raw', line });

    expect(mockGetUserModes).toHaveBeenCalledTimes(1);

    expect(mockSetTopic).toHaveBeenCalledTimes(1);
    expect(mockSetTopic).toHaveBeenCalledWith('#sic', 'Test 1');

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({ target: '#sic', message: 'Merovingian ustawił temat kanału na: Test 1' }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  // TODO tagmsg
  // TODO cap
});
