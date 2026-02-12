/**
 * @vitest-environment node
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { parseMessageToCommand } from '../command';
import { useChannelsStore } from '@features/channels/store/channels';
import { useSettingsStore } from '@features/settings/store/settings';
import { ChannelCategory } from '@shared/types';

describe('command tests', () => {
  beforeEach(() => {
    useSettingsStore.setState({ channelTypes: ['#', '&'] });
    useChannelsStore.setState({ openChannels: [], openChannelsShortList: [] });
  });
  it('test away command', () => {
    expect(parseMessageToCommand('#channel', '/away message')).toStrictEqual('away message');
  });

  it('test join command', () => {
    expect(parseMessageToCommand('#channel', '/j #nextChannel')).toStrictEqual('JOIN #nextChannel');
    expect(parseMessageToCommand('#channel', '/JOIN #nextChannel')).toStrictEqual('JOIN #nextChannel');
  });

  it('test quit command', () => {
    expect(parseMessageToCommand('#channel', '/q reason1 reason2')).toStrictEqual('QUIT reason1 reason2');
    expect(parseMessageToCommand('#channel', '/QUIT')).toStrictEqual('QUIT Simple Irc Client ( https://simpleircclient.com )');
  });

  it('test quote command', () => {
    useChannelsStore.setState({
      openChannels: [
        { name: '#channel', category: ChannelCategory.channel, messages: [], topic: '', topicSetBy: '', topicSetTime: 0, unReadMessages: 0, typing: [] },
      ],
      openChannelsShortList: [],
    });

    expect(parseMessageToCommand('#channel', '/raw test message')).toStrictEqual('test message');
    expect(parseMessageToCommand('#channel', '/quote test message')).toStrictEqual('test message');
    expect(parseMessageToCommand('#channel', 'test message')).toStrictEqual('test message');

    // /raw, /quote should each add an info message showing what was sent
    const messages = useChannelsStore.getState().openChannels[0]?.messages;
    expect(messages?.filter((m) => m.message.includes('test message')).length).toBe(2);

    // /msg sends PRIVMSG, not raw
    expect(parseMessageToCommand('#channel', '/msg user1 hello world')).toStrictEqual('PRIVMSG user1 :hello world');
    expect(parseMessageToCommand('#channel', '/MSG user1 hello world')).toStrictEqual('PRIVMSG user1 :hello world');
    // /msg without message returns original line
    expect(parseMessageToCommand('#channel', '/msg user1')).toStrictEqual('msg user1');
  });

  it('test whereis command', () => {
    expect(parseMessageToCommand('#channel', '/whereis user1')).toStrictEqual('WHOIS user1');
  });

  it('test who command', () => {
    expect(parseMessageToCommand('#channel', '/who user1')).toStrictEqual('who user1');
  });

  it('test cycle command', () => {
    expect(parseMessageToCommand('#channel', '/cycle')).toStrictEqual('PART #channel\nJOIN #channel');
    expect(parseMessageToCommand('#channel', '/cycle reason 1')).toStrictEqual('PART #channel :reason 1\nJOIN #channel');
    expect(parseMessageToCommand('#channel', '/hop')).toStrictEqual('PART #channel\nJOIN #channel');
    expect(parseMessageToCommand('#channel', '/hop reason 1')).toStrictEqual('PART #channel :reason 1\nJOIN #channel');
  });

  it('test invite command', () => {
    expect(parseMessageToCommand('#channel', '/invite')).toStrictEqual('invite');
    expect(parseMessageToCommand('#channel', '/invite user1')).toStrictEqual('INVITE user1 #channel');
  });

  it('test kick command', () => {
    expect(parseMessageToCommand('#channel', '/kick')).toStrictEqual('kick');
    expect(parseMessageToCommand('#channel', '/kick user1')).toStrictEqual('KICK #channel user1');
    expect(parseMessageToCommand('#channel', '/kick user1 reason1 reason2')).toStrictEqual('KICK #channel user1 :reason1 reason2');
    expect(parseMessageToCommand('#channel', '/k')).toStrictEqual('k');
    expect(parseMessageToCommand('#channel', '/k user1')).toStrictEqual('KICK #channel user1');
    expect(parseMessageToCommand('#channel', '/k user1 reason1 reason2')).toStrictEqual('KICK #channel user1 :reason1 reason2');
  });

  it('test part command', () => {
    expect(parseMessageToCommand('#channel', '/part')).toStrictEqual('PART #channel');
    expect(parseMessageToCommand('#channel', '/part reason1 reason2')).toStrictEqual('PART #channel :reason1 reason2');
    expect(parseMessageToCommand('#channel', '/p')).toStrictEqual('PART #channel');
    expect(parseMessageToCommand('#channel', '/p reason1 reason2')).toStrictEqual('PART #channel :reason1 reason2');
  });

  it('test topic command', () => {
    expect(parseMessageToCommand('#channel', '/topic new topic')).toStrictEqual('TOPIC #channel :new topic');
  });

  it('test ban command', () => {
    expect(parseMessageToCommand('#channel', '/ban')).toStrictEqual('MODE #channel +b');
    expect(parseMessageToCommand('#channel', '/ban *!*@*.example.com')).toStrictEqual('MODE #channel +b *!*@*.example.com');
    expect(parseMessageToCommand('#channel', '/b')).toStrictEqual('MODE #channel +b');
    expect(parseMessageToCommand('#channel', '/b nick!user@host')).toStrictEqual('MODE #channel +b nick!user@host');
  });

  it('test kickban command', () => {
    expect(parseMessageToCommand('#channel', '/kb')).toStrictEqual('kb');
    expect(parseMessageToCommand('#channel', '/kb user1')).toStrictEqual('MODE #channel +b user1\nKICK #channel user1');
    expect(parseMessageToCommand('#channel', '/kb user1 reason1 reason2')).toStrictEqual('MODE #channel +b user1\nKICK #channel user1 :reason1 reason2');
    expect(parseMessageToCommand('#channel', '/kban')).toStrictEqual('kban');
    expect(parseMessageToCommand('#channel', '/kban user1')).toStrictEqual('MODE #channel +b user1\nKICK #channel user1');
    expect(parseMessageToCommand('#channel', '/kban user1 reason1 reason2')).toStrictEqual('MODE #channel +b user1\nKICK #channel user1 :reason1 reason2');
  });

  it('test me command', () => {
    expect(parseMessageToCommand('#channel', '/me')).toStrictEqual('me');
    expect(parseMessageToCommand('#channel', '/me waves hello')).toStrictEqual('PRIVMSG #channel :\x01ACTION waves hello\x01');
  });

  it('test all command', () => {
    useChannelsStore.setState({
      openChannels: [
        { name: '#channel1', category: ChannelCategory.channel, messages: [], topic: '', topicSetBy: '', topicSetTime: 0, unReadMessages: 0, typing: [] },
        { name: '#channel2', category: ChannelCategory.channel, messages: [], topic: '', topicSetBy: '', topicSetTime: 0, unReadMessages: 0, typing: [] },
        { name: 'privUser', category: ChannelCategory.priv, messages: [], topic: '', topicSetBy: '', topicSetTime: 0, unReadMessages: 0, typing: [] },
      ],
      openChannelsShortList: [],
    });

    expect(parseMessageToCommand('#channel', '/all')).toStrictEqual('all');
    expect(parseMessageToCommand('#channel', '/all hello everyone')).toStrictEqual(
      'PRIVMSG #channel1 :hello everyone\nPRIVMSG #channel2 :hello everyone',
    );
    expect(parseMessageToCommand('#channel', '/amsg hello everyone')).toStrictEqual(
      'PRIVMSG #channel1 :hello everyone\nPRIVMSG #channel2 :hello everyone',
    );
  });

  it('test help command', () => {
    useChannelsStore.setState({
      openChannels: [
        { name: '#channel', category: ChannelCategory.channel, messages: [], topic: '', topicSetBy: '', topicSetTime: 0, unReadMessages: 0, typing: [] },
      ],
      openChannelsShortList: [],
    });

    expect(parseMessageToCommand('#channel', '/help')).toStrictEqual('');

    const messages = useChannelsStore.getState().openChannels[0]?.messages;
    expect(messages?.length).toBeGreaterThan(0);
    expect(messages?.[0]?.message).toStrictEqual('--- Dostępne komendy ---'); // Polish is default language
  });

  // Services commands tests
  it('test ns command', () => {
    expect(parseMessageToCommand('#channel', '/ns identify password')).toStrictEqual('PRIVMSG NickServ :identify password');
    expect(parseMessageToCommand('#channel', '/ns')).toStrictEqual('PRIVMSG NickServ :HELP');
  });

  it('test cs command', () => {
    expect(parseMessageToCommand('#channel', '/cs op #channel nick')).toStrictEqual('PRIVMSG ChanServ :op #channel nick');
    expect(parseMessageToCommand('#channel', '/cs')).toStrictEqual('PRIVMSG ChanServ :HELP');
  });

  it('test hs command', () => {
    expect(parseMessageToCommand('#channel', '/hs on')).toStrictEqual('PRIVMSG HostServ :on');
  });

  it('test bs command', () => {
    expect(parseMessageToCommand('#channel', '/bs assign #channel bot')).toStrictEqual('PRIVMSG BotServ :assign #channel bot');
  });

  it('test ms command', () => {
    expect(parseMessageToCommand('#channel', '/ms list')).toStrictEqual('PRIVMSG MemoServ :list');
  });

  // General commands tests
  it('test notice command', () => {
    expect(parseMessageToCommand('#channel', '/notice')).toStrictEqual('notice');
    expect(parseMessageToCommand('#channel', '/notice user1')).toStrictEqual('notice user1');
    expect(parseMessageToCommand('#channel', '/notice user1 Hello there!')).toStrictEqual('NOTICE user1 :Hello there!');
  });

  it('test nick command', () => {
    expect(parseMessageToCommand('#channel', '/nick')).toStrictEqual('nick');
    expect(parseMessageToCommand('#channel', '/nick newNick')).toStrictEqual('NICK newNick');
  });

  it('test mode command', () => {
    expect(parseMessageToCommand('#channel', '/mode #channel +o nick')).toStrictEqual('MODE #channel +o nick');
    expect(parseMessageToCommand('#channel', '/mode nick +i')).toStrictEqual('MODE nick +i');
    expect(parseMessageToCommand('#channel', '/mode')).toStrictEqual('MODE ');
  });

  it('test whowas command', () => {
    expect(parseMessageToCommand('#channel', '/whowas')).toStrictEqual('whowas');
    expect(parseMessageToCommand('#channel', '/whowas oldnick')).toStrictEqual('WHOWAS oldnick');
  });

  it('test names command', () => {
    expect(parseMessageToCommand('#channel', '/names')).toStrictEqual('NAMES');
    expect(parseMessageToCommand('#channel', '/names #otherchannel')).toStrictEqual('NAMES #otherchannel');
  });

  it('test knock command', () => {
    expect(parseMessageToCommand('#channel', '/knock')).toStrictEqual('knock');
    expect(parseMessageToCommand('#channel', '/knock #secretchannel')).toStrictEqual('KNOCK #secretchannel');
    expect(parseMessageToCommand('#channel', '/knock #secretchannel Please let me in')).toStrictEqual('KNOCK #secretchannel :Please let me in');
  });

  it('test watch command', () => {
    expect(parseMessageToCommand('#channel', '/watch')).toStrictEqual('WATCH L');
    expect(parseMessageToCommand('#channel', '/watch +friend')).toStrictEqual('WATCH +friend');
    expect(parseMessageToCommand('#channel', '/watch -friend')).toStrictEqual('WATCH -friend');
  });

  // Quick mode commands tests
  it('test op command', () => {
    expect(parseMessageToCommand('#channel', '/op')).toStrictEqual('op');
    expect(parseMessageToCommand('#channel', '/op user1')).toStrictEqual('MODE #channel +o user1');
  });

  it('test deop command', () => {
    expect(parseMessageToCommand('#channel', '/deop')).toStrictEqual('deop');
    expect(parseMessageToCommand('#channel', '/deop user1')).toStrictEqual('MODE #channel -o user1');
  });

  it('test voice command', () => {
    expect(parseMessageToCommand('#channel', '/voice')).toStrictEqual('voice');
    expect(parseMessageToCommand('#channel', '/voice user1')).toStrictEqual('MODE #channel +v user1');
  });

  it('test devoice command', () => {
    expect(parseMessageToCommand('#channel', '/devoice')).toStrictEqual('devoice');
    expect(parseMessageToCommand('#channel', '/devoice user1')).toStrictEqual('MODE #channel -v user1');
  });

  it('test halfop command', () => {
    expect(parseMessageToCommand('#channel', '/halfop')).toStrictEqual('halfop');
    expect(parseMessageToCommand('#channel', '/halfop user1')).toStrictEqual('MODE #channel +h user1');
  });

  it('test dehalfop command', () => {
    expect(parseMessageToCommand('#channel', '/dehalfop')).toStrictEqual('dehalfop');
    expect(parseMessageToCommand('#channel', '/dehalfop user1')).toStrictEqual('MODE #channel -h user1');
  });

  // Channel-only commands should not work on Status channel
  it('test channel-only commands on Status channel', () => {
    expect(parseMessageToCommand('Status', '/op user1')).toStrictEqual('op user1');
    expect(parseMessageToCommand('Status', '/voice user1')).toStrictEqual('voice user1');
    expect(parseMessageToCommand('Status', '/kick user1')).toStrictEqual('kick user1');
  });
});
