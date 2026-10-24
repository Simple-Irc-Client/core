/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Kernel } from '@/network/irc/kernel';
import * as channelsFile from '@features/channels/store/channels';
import * as settingsFile from '@features/settings/store/settings';
import * as usersFile from '@features/users/store/users';
import * as chatHistoryFile from '@/network/irc/chatHistory';
import { type Message, MessageCategory } from '@shared/types';
import { defaultUserModes, setupKernelTest } from '@/network/irc/kernel/__tests__/fixtures';
import { createLabel } from '@/network/irc/labels';

const REDACTED = { message: '', reactions: undefined, redacted: true };

const shown = (overrides: Partial<Message> = {}): Message => ({
  id: 'm1',
  msgid: 'm1',
  message: 'hello',
  nick: 'alice',
  target: '#sic',
  time: '2026-10-24T10:00:00.000Z',
  category: MessageCategory.default,
  ...overrides,
});

describe('kernel ircv3/redact', () => {
  setupKernelTest();

  let messages: Message[];
  let update: ReturnType<typeof vi.spyOn>;

  const handle = (line: string): void => new Kernel({ type: 'raw', line }).handle();

  beforeEach(() => {
    messages = [shown({ reactions: [{ emoji: '👍', nicks: ['bob'] }] })];
    vi.spyOn(channelsFile, 'setAddMessage').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getUserModes').mockImplementation(() => defaultUserModes);
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'me');
    vi.spyOn(channelsFile, 'getMessages').mockImplementation((window) => messages.filter((message) => message.target === window));
    update = vi.spyOn(channelsFile, 'setUpdateMessage').mockImplementation(() => {});
  });

  it('deletes the message with that msgid, its text and reactions', () => {
    handle('@msgid=x1 :alice!~u@host REDACT #sic m1');

    expect(update).toHaveBeenCalledExactlyOnceWith('#sic', 'm1', REDACTED);
  });

  it.each([':op!~u@host REDACT #sic m1 :spam', ':op!~u@host REDACT #sic :m1'])('takes the msgid with a reason after it, or as the trailing parameter: %s', (line) => {
    handle(line);

    expect(update).toHaveBeenCalledExactlyOnceWith('#sic', 'm1', REDACTED);
  });

  it('deletes in a DM, in the window named after the peer', () => {
    messages = [shown({ target: 'alice' })];

    handle(':alice!~u@host REDACT me m1');

    expect(update).toHaveBeenCalledExactlyOnceWith('alice', 'm1', REDACTED);
  });

  it('deletes our own DM message, relayed back to us', () => {
    messages = [shown({ target: 'bob', nick: 'me' })];

    handle(':me!~u@host REDACT bob m1');

    expect(update).toHaveBeenCalledExactlyOnceWith('bob', 'm1', REDACTED);
  });

  it('ignores a msgid not shown, or one shown in another window', () => {
    handle(':alice!~u@host REDACT #sic unknown');
    handle(':alice!~u@host REDACT #other m1');

    expect(update).not.toHaveBeenCalled();
  });

  it('ignores a message deleted already', () => {
    messages = [shown({ ...REDACTED })];

    handle(':alice!~u@host REDACT #sic m1');

    expect(update).not.toHaveBeenCalled();
  });

  it('ignores a REDACT without a msgid', () => {
    handle(':alice!~u@host REDACT #sic');
    handle(':alice!~u@host REDACT');

    expect(update).not.toHaveBeenCalled();
  });

  it('deletes our own message, its relay coming in a labeled-response batch', () => {
    const label = createLabel({ window: '#sic' });
    handle(`@label=${label} :ergo.test BATCH +lr labeled-response`);
    handle('@batch=lr;msgid=x1 :me!~u@host REDACT #sic m1');
    handle(':ergo.test BATCH -lr');

    expect(update).toHaveBeenCalledExactlyOnceWith('#sic', 'm1', REDACTED);
  });

  describe('in chathistory', () => {
    let setAddHistoryPage: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      vi.spyOn(settingsFile, 'getCurrentChannelName').mockImplementation(() => '#other');
      vi.spyOn(channelsFile, 'existChannel').mockImplementation(() => true);
      vi.spyOn(usersFile, 'getUser').mockImplementation(() => undefined);
      vi.spyOn(chatHistoryFile, 'onHistoryBatch').mockImplementation(() => {});
      setAddHistoryPage = vi.spyOn(channelsFile, 'setAddHistoryPage').mockImplementation(() => {});
    });

    it('deletes a message in the same page', () => {
      handle(':ergo.test BATCH +hist chathistory #sic');
      handle('@batch=hist;msgid=p1;time=2026-10-24T09:00:00.000Z :alice!~u@host PRIVMSG #sic :oops');
      handle('@batch=hist;msgid=x1;time=2026-10-24T09:01:00.000Z :alice!~u@host REDACT #sic p1');
      handle(':ergo.test BATCH -hist');

      expect(setAddHistoryPage).toHaveBeenCalledExactlyOnceWith([expect.objectContaining({ id: 'p1', msgid: 'p1', ...REDACTED })], undefined);
      expect(update).not.toHaveBeenCalled();
    });
  });
});
