/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import * as networkFile from '@/network/irc/network';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel core/info/isupport', () => {
  setupKernelTest();

  it('test raw 005 chantypes', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const mockSetChannelTypes = vi.spyOn(settingsFile, 'setChannelTypes').mockImplementation(() => {});
    const mockSetChannelModes = vi.spyOn(settingsFile, 'setChannelModes').mockImplementation(() => {});
    const mockSetSupportedOption = vi.spyOn(settingsFile, 'setSupportedOption').mockImplementation(() => {});
    const mockIrcSendNamesXProto = vi.spyOn(networkFile, 'ircSendNamesXProto').mockImplementation(() => {});

    const line =
      ':netsplit.pirc.pl 005 SIC-test AWAYLEN=307 BOT=B CASEMAPPING=ascii CHANLIMIT=#:30 CHANMODES=beI,fkL,lH,cdimnprstzBCDGKMNOPQRSTVZ CHANNELLEN=32 CHANTYPES=# CHATHISTORY=50 CLIENTTAGDENY=*,-draft/typing,-typing,-draft/reply DEAF=d ELIST=MNUCT EXCEPTS :are supported by this server';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetChannelTypes).toHaveBeenNthCalledWith(1, ['#']);

    expect(mockSetChannelTypes).toHaveBeenCalledTimes(1);

    expect(mockSetChannelModes).toHaveBeenCalledTimes(1);
    expect(mockSetChannelModes).toHaveBeenCalledWith({
      A: ['b', 'e', 'I'],
      B: ['f', 'k', 'L'],
      C: ['l', 'H'],
      D: ['c', 'd', 'i', 'm', 'n', 'p', 'r', 's', 't', 'z', 'B', 'C', 'D', 'G', 'K', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'V', 'Z'],
    });

    expect(mockSetSupportedOption).toHaveBeenCalledTimes(0);
    expect(mockIrcSendNamesXProto).toHaveBeenCalledTimes(0);

    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        target: STATUS_CHANNEL,
        message:
          'AWAYLEN=307 BOT=B CASEMAPPING=ascii CHANLIMIT=#:30 CHANMODES=beI,fkL,lH,cdimnprstzBCDGKMNOPQRSTVZ CHANNELLEN=32 CHANTYPES=# CHATHISTORY=50 CLIENTTAGDENY=*,-draft/typing,-typing,-draft/reply DEAF=d ELIST=MNUCT EXCEPTS :are supported by this server',
      }),
    );
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 005 prefix', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});

    const mockSetUserModes = vi.spyOn(settingsFile, 'setUserModes').mockImplementation(() => {});
    const mockSetSupportedOption = vi.spyOn(settingsFile, 'setSupportedOption').mockImplementation(() => {});
    const mockSetChannelModes = vi.spyOn(settingsFile, 'setChannelModes').mockImplementation(() => {});
    const mockIrcSendNamesXProto = vi.spyOn(networkFile, 'ircSendNamesXProto').mockImplementation(() => {});
    const mockSetNickLenLimit = vi.spyOn(settingsFile, 'setNickLenLimit').mockImplementation(() => {});

    const line =
      ':netsplit.pirc.pl 005 SIC-test MONITOR=128 NAMELEN=50 NAMESX NETWORK=pirc.pl NICKLEN=30 PREFIX=(qaohv)~&@%+ QUITLEN=307 SAFELIST SILENCE=15 STATUSMSG=~&@%+ TARGMAX=DCCALLOW:,ISON:,JOIN:,KICK:4,KILL:,LIST:,NAMES:1,NOTICE:1,PART:,PRIVMSG:4,SAJOIN:,SAPART:,TAGMSG:1,USERHOST:,USERIP:,WATCH:,WHOIS:1,WHOWAS:1 TOPICLEN=360 :are supported by this server';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetUserModes).toHaveBeenNthCalledWith(1, [
      { flag: 'q', symbol: '~' },
      { flag: 'a', symbol: '&' },
      { flag: 'o', symbol: '@' },
      { flag: 'h', symbol: '%' },
      { flag: 'v', symbol: '+' },
    ]);
    expect(mockSetUserModes).toHaveBeenCalledTimes(1);
    expect(mockSetChannelModes).toHaveBeenCalledTimes(0);
    expect(mockSetSupportedOption).toHaveBeenCalledWith('NAMESX');
    expect(mockIrcSendNamesXProto).toHaveBeenCalledTimes(1);
    expect(mockSetNickLenLimit).toHaveBeenCalledWith(30);
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ target: DEBUG_CHANNEL, message: `>> ${line}` }));
    expect(mockSetAddMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        target: STATUS_CHANNEL,
        message:
          'MONITOR=128 NAMELEN=50 NAMESX NETWORK=pirc.pl NICKLEN=30 PREFIX=(qaohv)~&@%+ QUITLEN=307 SAFELIST SILENCE=15 STATUSMSG=~&@%+ TARGMAX=DCCALLOW:,ISON:,JOIN:,KICK:4,KILL:,LIST:,NAMES:1,NOTICE:1,PART:,PRIVMSG:4,SAJOIN:,SAPART:,TAGMSG:1,USERHOST:,USERIP:,WATCH:,WHOIS:1,WHOWAS:1 TOPICLEN=360 :are supported by this server',
      }),
    );
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 005 without NICKLEN defaults to 50', () => {
    const mockSetAddMessage = vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'setUserModes').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'setSupportedOption').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'setChannelModes').mockImplementation(() => {});
    vi.spyOn(networkFile, 'ircSendNamesXProto').mockImplementation(() => {});
    const mockSetNickLenLimit = vi.spyOn(settingsFile, 'setNickLenLimit').mockImplementation(() => {});

    const line =
      ':server.example.com 005 SIC-test NETWORK=example SAFELIST :are supported by this server';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetNickLenLimit).not.toHaveBeenCalled();
    expect(mockSetAddMessage).toHaveBeenCalledTimes(2);
  });

  it('test raw 005 bare WHOX token enables WHOX', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetSupportedOption = vi.spyOn(settingsFile, 'setSupportedOption').mockImplementation(() => {});

    const line = ':ergo.test 005 probe TOPICLEN=390 UTF8ONLY WHOX draft/CHATHISTORY=100 :are supported by this server';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetSupportedOption).toHaveBeenCalledWith('WHOX');
    expect(mockSetSupportedOption).toHaveBeenCalledTimes(1);
  });

  it('test raw 005 list limits without a value mean no limit', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetMonitorLimit = vi.spyOn(settingsFile, 'setMonitorLimit').mockImplementation(() => {});
    const mockSetWatchLimit = vi.spyOn(settingsFile, 'setWatchLimit').mockImplementation(() => {});
    const mockSetSilenceLimit = vi.spyOn(settingsFile, 'setSilenceLimit').mockImplementation(() => {});

    const line = ':server 005 nick MONITOR WATCH SILENCE=15 :are supported by this server';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetMonitorLimit).toHaveBeenCalledWith(Number.POSITIVE_INFINITY);
    expect(mockSetWatchLimit).toHaveBeenCalledWith(Number.POSITIVE_INFINITY);
    expect(mockSetSilenceLimit).toHaveBeenCalledWith(15);
  });

  it('test raw 005 ignores words of the trailing text', () => {
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    const mockSetSupportedOption = vi.spyOn(settingsFile, 'setSupportedOption').mockImplementation(() => {});

    const line = ':server 005 nick SAFELIST :WHOX NAMESX are supported by this server';

    new Kernel({ type: 'raw', line }).handle();

    expect(mockSetSupportedOption).not.toHaveBeenCalled();
  });

  describe('CASEMAPPING', () => {
    it('should take the mapping from 005', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      const mockSetCaseMapping = vi.spyOn(settingsFile, 'setCaseMapping').mockImplementation(() => {});

      new Kernel({ type: 'raw', line: ':server 005 SIC-test CASEMAPPING=ascii CHANTYPES=# :are supported by this server' }).handle();

      expect(mockSetCaseMapping).toHaveBeenCalledWith('ascii');
    });

    it('should fall back to the spec default for a mapping we do not implement', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      const mockSetCaseMapping = vi.spyOn(settingsFile, 'setCaseMapping').mockImplementation(() => {});

      new Kernel({ type: 'raw', line: ':server 005 SIC-test CASEMAPPING=utf8 :are supported by this server' }).handle();

      expect(mockSetCaseMapping).toHaveBeenCalledWith('rfc1459');
    });

    it('should not touch the mapping when 005 does not advertise one', () => {
      vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
      const mockSetCaseMapping = vi.spyOn(settingsFile, 'setCaseMapping').mockImplementation(() => {});

      new Kernel({ type: 'raw', line: ':server 005 SIC-test CHANTYPES=# NICKLEN=30 :are supported by this server' }).handle();

      expect(mockSetCaseMapping).not.toHaveBeenCalled();
    });
  });
});
