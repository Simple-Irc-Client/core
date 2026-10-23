/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as settingsFile from '@features/settings/store/settings';
import * as channelsFile from '@features/channels/store/channels';
import * as networkFile from '@/network/irc/network';
import * as notificationsFile from '@/runtime/notifications';
import { useIgnoreStore } from '@features/ignore/store/ignore';
import { DEBUG_CHANNEL } from '@/config/config';
import { setupKernelTest, defaultUserModes } from '@/network/irc/kernel/__tests__/fixtures';

describe('kernel: ignored users', () => {
  setupKernelTest();

  const mockEnvironment = () => {
    vi.spyOn(settingsFile, 'getServer').mockReturnValue({ default: 0, encoding: 'utf8', network: 'TestNet', servers: ['irc.test:6667'] });
    vi.spyOn(settingsFile, 'getCurrentNick').mockReturnValue('MyNick');
    vi.spyOn(settingsFile, 'getUserModes').mockReturnValue(defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentChannelName').mockReturnValue('#other');
    vi.spyOn(settingsFile, 'getCurrentUserFlags').mockReturnValue([]);
    vi.spyOn(channelsFile, 'existChannel').mockReturnValue(true);
    return {
      setAddMessage: vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {}),
      setAddChannel: vi.spyOn(channelsFile, 'setAddChannel').mockImplementation(() => {}),
      setIncreaseUnreadMessages: vi.spyOn(channelsFile, 'setIncreaseUnreadMessages').mockImplementation(() => {}),
      setTyping: vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {}),
      ircSendRawMessage: vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {}),
      notifyHighlight: vi.spyOn(notificationsFile, 'notifyHighlight').mockResolvedValue(),
    };
  };

  const shownMessages = (setAddMessage: ReturnType<typeof mockEnvironment>['setAddMessage']) =>
    setAddMessage.mock.calls.filter(([message]) => message.target !== DEBUG_CHANNEL);

  beforeEach(() => {
    useIgnoreStore.setState({ masksByNetwork: { TestNet: ['troll!*@*', '*!*@*.spam.example'] } });
  });

  it('should drop a channel message, unread count and highlight included', () => {
    const mocks = mockEnvironment();

    new Kernel({ type: 'raw', line: ':Troll!~t@host PRIVMSG #channel :hey MyNick' }).handle();

    expect(shownMessages(mocks.setAddMessage)).toEqual([]);
    expect(mocks.setIncreaseUnreadMessages).not.toHaveBeenCalled();
    expect(mocks.notifyHighlight).not.toHaveBeenCalled();
  });

  it('should drop a private message without opening its window', () => {
    const mocks = mockEnvironment();
    vi.spyOn(channelsFile, 'existChannel').mockReturnValue(false);

    new Kernel({ type: 'raw', line: ':someone!u@a.spam.example PRIVMSG MyNick :buy now' }).handle();

    expect(shownMessages(mocks.setAddMessage)).toEqual([]);
    expect(mocks.setAddChannel).not.toHaveBeenCalled();
  });

  it('should not answer a CTCP request', () => {
    const mocks = mockEnvironment();

    new Kernel({ type: 'raw', line: ':troll!~t@host PRIVMSG MyNick :\x01VERSION\x01' }).handle();

    expect(mocks.ircSendRawMessage).not.toHaveBeenCalled();
  });

  it('should drop a notice', () => {
    const mocks = mockEnvironment();

    new Kernel({ type: 'raw', line: ':troll!~t@host NOTICE MyNick :psst' }).handle();

    expect(shownMessages(mocks.setAddMessage)).toEqual([]);
  });

  it('should drop typing notifications', () => {
    const mocks = mockEnvironment();

    new Kernel({ type: 'raw', line: '@+typing=active :troll!~t@host TAGMSG #channel' }).handle();

    expect(mocks.setTyping).not.toHaveBeenCalled();
  });

  it('should drop an invite', () => {
    const mocks = mockEnvironment();

    new Kernel({ type: 'raw', line: ':troll!~t@host INVITE MyNick :#trap' }).handle();

    expect(shownMessages(mocks.setAddMessage)).toEqual([]);
  });

  it('should drop a message replayed from history', () => {
    mockEnvironment();
    const setAddHistoryPage = vi.spyOn(channelsFile, 'setAddHistoryPage').mockImplementation(() => {});

    for (const line of [
      'BATCH +hist chathistory #channel',
      '@batch=hist;time=2026-10-23T10:00:00.000Z :troll!~t@host PRIVMSG #channel :old spam',
      '@batch=hist;time=2026-10-23T10:00:01.000Z :friend!~f@host PRIVMSG #channel :old news',
      'BATCH -hist',
    ]) {
      new Kernel({ type: 'raw', line }).handle();
    }

    expect(setAddHistoryPage.mock.calls[0]?.[0].map((message) => message.message)).toEqual(['old news']);
  });

  it('should still show others, and server notices', () => {
    const mocks = mockEnvironment();

    new Kernel({ type: 'raw', line: ':friend!~f@host PRIVMSG #channel :hello' }).handle();
    new Kernel({ type: 'raw', line: ':irc.spam.example NOTICE MyNick :server news' }).handle();

    expect(shownMessages(mocks.setAddMessage).map(([message]) => message.message)).toEqual(['hello', 'server news']);
  });
});
