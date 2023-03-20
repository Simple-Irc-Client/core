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
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => []);
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
      maxMode: -1,
      modes: [],
      nick: '+Alisha',
    });
    expect(mockSetAddUser).toHaveBeenNthCalledWith(3, {
      channels: ['#Religie'],
      hostname: 'AB43659:6EA4AE53:B58B785A:IP',
      ident: '~ProrokCod',
      maxMode: -1,
      modes: [],
      nick: '+ProrokCodzienny',
    });
    expect(mockSetAddUser).toHaveBeenNthCalledWith(4, {
      channels: ['#Religie'],
      hostname: 'bot:kanalowy.pomocnik',
      ident: 'pomocny',
      maxMode: -1,
      modes: [],
      nick: '&@Pomocnik',
    });
    expect(mockIrcRequestMetadata).toHaveBeenCalledTimes(4);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `<- ${line}` }));
    expect(mockSetAddMessage).toHaveBeenCalledTimes(1);
  });

  it('test raw 353 #2', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockGetUserModes = vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => []);
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
});
