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
    expect(parseMessageToCommand('#channel', '/QUIT')).toStrictEqual('QUIT Leaving');
  });

  it('test quote command', () => {
    expect(parseMessageToCommand('#channel', '/raw test message')).toStrictEqual('test message');
    expect(parseMessageToCommand('#channel', '/quote test message')).toStrictEqual('test message');
    expect(parseMessageToCommand('#channel', '/msg test message')).toStrictEqual('test message');
    expect(parseMessageToCommand('#channel', '/MSG test message')).toStrictEqual('test message');
    expect(parseMessageToCommand('#channel', 'test message')).toStrictEqual('test message');
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
});
