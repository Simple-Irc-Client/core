/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as channelsFile from '@features/channels/store/channels';
import * as networksStore from '@features/networks/store/networks';
import * as usersFile from '@features/users/store/users';
import * as chatHistoryFile from '@/network/irc/chatHistory';
import { type Message, MessageCategory } from '@shared/types';
import { defaultUserModes, setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';

const shown = (overrides: Partial<Message> = {}): Message => ({
  id: 'm1',
  msgid: 'm1',
  message: 'hello',
  nick: 'alice',
  target: '#sic',
  time: '2026-10-23T10:00:00.000Z',
  category: MessageCategory.default,
  ...overrides,
});

describe('kernel ircv3/react', () => {
  setupKernelTest();

  let messages: Message[];
  let update: ReturnType<typeof vi.spyOn>;
  let setTyping: ReturnType<typeof vi.spyOn>;

  const handle = (line: string): void => new Kernel({ type: 'raw', line }).handle();

  beforeEach(() => {
    messages = [shown()];
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(networksStore, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(networksStore, 'getCurrentNick').mockImplementation(() => 'me');
    vi.spyOn(channelsFile, 'getMessages').mockImplementation((window) => messages.filter((message) => message.target === window));
    update = vi.spyOn(channelsFile, 'setUpdateMessage').mockImplementation(() => {});
    setTyping = vi.spyOn(channelsFile, 'setTyping').mockImplementation(() => {});
  });

  it('adds a reaction to the message it replies to', () => {
    handle('@+draft/react=👍;+draft/reply=m1;msgid=r1 :bob!~u@host TAGMSG #sic');

    expect(update).toHaveBeenCalledExactlyOnceWith('#sic', 'm1', { reactions: [{ emoji: '👍', nicks: ['bob'] }] });
    expect(setTyping).not.toHaveBeenCalled();
  });

  it('takes a reaction back on unreact', () => {
    messages = [shown({ reactions: [{ emoji: '👍', nicks: ['bob', 'carol'] }] })];

    handle('@+draft/unreact=👍;+draft/reply=m1 :bob!~u@host TAGMSG #sic');

    expect(update).toHaveBeenCalledExactlyOnceWith('#sic', 'm1', { reactions: [{ emoji: '👍', nicks: ['carol'] }] });
  });

  it('counts our own, echoed back or sent from another client', () => {
    handle('@+draft/react=😂;+draft/reply=m1 :me!~u@host TAGMSG #sic');

    expect(update).toHaveBeenCalledExactlyOnceWith('#sic', 'm1', { reactions: [{ emoji: '😂', nicks: ['me'] }] });
  });

  it('puts a reaction in a DM in the window named after the peer', () => {
    messages = [shown({ target: 'bob' })];

    handle('@+draft/react=👍;+draft/reply=m1 :bob!~u@host TAGMSG me');
    handle('@+draft/react=❤️;+draft/reply=m1 :me!~u@host TAGMSG bob');

    expect(update).toHaveBeenNthCalledWith(1, 'bob', 'm1', { reactions: [{ emoji: '👍', nicks: ['bob'] }] });
    expect(update).toHaveBeenNthCalledWith(2, 'bob', 'm1', { reactions: [{ emoji: '❤️', nicks: ['me'] }] });
  });

  it.each([
    ['without a message to reply to', '@+draft/react=👍 :bob!~u@host TAGMSG #sic'],
    ['with an empty reaction', '@+draft/react=;+draft/reply=m1 :bob!~u@host TAGMSG #sic'],
    ['for a message not shown', '@+draft/react=👍;+draft/reply=gone :bob!~u@host TAGMSG #sic'],
    ['without a target', '@+draft/react=👍;+draft/reply=m1 :bob!~u@host TAGMSG'],
  ])('ignores a reaction %s', (_case, line) => {
    handle(line);

    expect(update).not.toHaveBeenCalled();
  });

  it('still shows typing from a TAGMSG without a reaction', () => {
    handle('@+typing=active :bob!~u@host TAGMSG #sic');

    expect(setTyping).toHaveBeenCalledExactlyOnceWith('#sic', 'bob', 'active');
    expect(update).not.toHaveBeenCalled();
  });

  describe('in chathistory', () => {
    let setAddHistoryPage: ReturnType<typeof vi.spyOn>;

    const replay = (lines: string[]): void => {
      handle(':ergo.test BATCH +hist chathistory #sic');
      for (const line of lines) {
        handle(`@batch=hist;${line}`);
      }
      handle(':ergo.test BATCH -hist');
    };

    beforeEach(() => {
      vi.spyOn(networksStore, 'getCurrentChannelName').mockImplementation(() => '#other');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(chatHistoryFile, 'onHistoryBatch').mockImplementation(() => {});
      setAddHistoryPage = vi.spyOn(channelsFile, 'setAddHistoryPage').mockImplementation(() => {});
    });

    it('puts a reaction on its message in the same page', () => {
      replay([
        'msgid=p1;time=2026-10-23T09:00:00.000Z :alice!~u@host PRIVMSG #sic :first',
        '+draft/react=👍;+draft/reply=p1;msgid=r1;time=2026-10-23T09:01:00.000Z :bob!~u@host TAGMSG #sic',
        '+draft/react=👍;+draft/reply=p1;msgid=r2;time=2026-10-23T09:02:00.000Z :carol!~u@host TAGMSG #sic',
        '+draft/unreact=👍;+draft/reply=p1;msgid=r3;time=2026-10-23T09:03:00.000Z :bob!~u@host TAGMSG #sic',
        '+typing=active;time=2026-10-23T09:04:00.000Z :dave!~u@host TAGMSG #sic',
      ]);

      expect(setAddHistoryPage).toHaveBeenCalledExactlyOnceWith(
        [expect.objectContaining({ id: 'p1', msgid: 'p1', reactions: [{ emoji: '👍', nicks: ['carol'] }] })],
        undefined,
      );
      // Not shown before the page
      expect(update).not.toHaveBeenCalled();
      expect(setTyping).not.toHaveBeenCalled();
    });

    it('puts a reaction on a message both in the page and shown already', () => {
      replay([
        'msgid=m1;time=2026-10-23T10:00:00.000Z :alice!~u@host PRIVMSG #sic :hello',
        '+draft/react=👍;+draft/reply=m1;msgid=r1;time=2026-10-23T10:01:00.000Z :bob!~u@host TAGMSG #sic',
      ]);

      expect(setAddHistoryPage).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ id: 'm1', reactions: [{ emoji: '👍', nicks: ['bob'] }] })], undefined);
      expect(update).toHaveBeenCalledExactlyOnceWith('#sic', 'm1', { reactions: [{ emoji: '👍', nicks: ['bob'] }] });
    });

    it('puts a reaction on a message shown already', () => {
      replay(['+draft/react=👍;+draft/reply=m1;msgid=r1;time=2026-10-23T10:01:00.000Z :bob!~u@host TAGMSG #sic']);

      expect(update).toHaveBeenCalledExactlyOnceWith('#sic', 'm1', { reactions: [{ emoji: '👍', nicks: ['bob'] }] });
    });
  });
});
