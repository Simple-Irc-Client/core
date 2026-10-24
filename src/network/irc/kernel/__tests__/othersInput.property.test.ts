/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import { Kernel } from '@/network/irc/kernel';
import { getChannel, getMessages, useChannelsStore } from '@features/channels/store/channels';
import { useChannelListStore } from '@features/channels/store/channelList';
import { getUser, setAddUser, setUsersClearAll } from '@features/users/store/users';
import { useSettingsStore } from '@features/settings/store/settings';
import { escapeTagValue } from '@/network/irc/helpers';
import * as networkFile from '@/network/irc/network';
import { ChannelCategory, MessageCategory } from '@shared/types';
import { setupKernelTest } from './fixtures';

/** What fits in one IRC line's trailing parameter: anything but a line break or NUL */
const lineText = fc.string({ unit: 'binary', maxLength: 80 }).map((text) => text.replace(/[\r\n\0]/g, ''));
const someText = lineText.filter((text) => text.trim() !== '');

describe('what others write, as we show it, for any text', () => {
  setupKernelTest();

  const handle = (line: string) => new Kernel({ type: 'raw', line }).handle();
  const shown = () => getMessages('#chan');

  beforeEach(() => {
    useSettingsStore.setState({ nick: 'me', caseMapping: 'rfc1459', currentChannelName: 'Status', isConnected: true });
    vi.spyOn(networkFile, 'ircSendRawMessage').mockImplementation(() => {});
    useChannelsStore.getState().setClearAll();
    useChannelsStore.getState().setAddChannel('#chan', ChannelCategory.channel);
    setUsersClearAll();
    setAddUser({ nick: 'alice', ident: 'a', hostname: 'host', flags: [], channels: [{ name: '#chan', flags: [], maxPermission: -1 }] });
  });

  it('a message is shown as written, ours never confused with it', () => {
    fc.assert(fc.property(someText.filter((text) => !text.startsWith('\x01')), (text) => {
      handle(`:alice!a@host PRIVMSG #chan :${text}`);
      expect(shown().at(-1)).toMatchObject({ message: text, category: MessageCategory.default, target: '#chan' });
    }));
  });

  it('a topic is kept as written, whether set now or reported on joining', () => {
    fc.assert(fc.property(lineText, (topic) => {
      handle(`:alice!a@host TOPIC #chan :${topic}`);
      expect(getChannel('#chan')?.topic).toBe(topic);
      handle(`:server 332 me #chan :${topic}x`);
      expect(getChannel('#chan')?.topic).toBe(`${topic}x`);
    }));
  });

  it('a part, quit or kick reason is shown, and never throws', () => {
    fc.assert(fc.property(someText, fc.constantFrom('PART #chan', 'QUIT', 'KICK #chan bob'), (reason, command) => {
      setAddUser({ nick: 'alice', ident: 'a', hostname: 'host', flags: [], channels: [{ name: '#chan', flags: [], maxPermission: -1 }] });
      setAddUser({ nick: 'bob', ident: 'b', hostname: 'host', flags: [], channels: [{ name: '#chan', flags: [], maxPermission: -1 }] });
      expect(() => handle(`:alice!a@host ${command} :${reason}`)).not.toThrow();
      expect(shown().at(-1)?.message).toContain(reason.trim().split(' ')[0]);
    }));
  });

  it('a real name changed with SETNAME is kept as written', () => {
    fc.assert(fc.property(someText, (realname) => {
      handle(`:alice!a@host SETNAME :${realname}`);
      expect(getUser('alice')?.realname).toBe(realname);
    }));
  });

  it('a channel listed with any name and topic is listed as sent', () => {
    // eslint-disable-next-line no-control-regex
    fc.assert(fc.property(fc.stringMatching(/^#[^\s,\x07\0]{1,30}$/), fc.nat(100_000), lineText, (name, users, topic) => {
      useChannelListStore.setState({ channels: [] });
      handle(`:server 322 me ${name} ${users} :${topic}`);
      expect(useChannelListStore.getState().channels.at(-1)).toEqual({ name, users, topic });
    }));
  });

  it('a channel display name from metadata is kept as written', () => {
    fc.assert(fc.property(someText, (displayName) => {
      handle(`:server METADATA #chan display-name * :${displayName}`);
      expect(getChannel('#chan')?.displayName).toBe(displayName);
    }));
  });

  it('a reaction with any emoji lands on its message as sent', () => {
    fc.assert(fc.property(fc.string({ unit: 'binary', minLength: 1, maxLength: 10 }).filter((emoji) => emoji.trim() !== ''), (emoji) => {
      handle('@msgid=target :bob!b@host PRIVMSG #chan :react to me');
      handle(`@+draft/react=${escapeTagValue(emoji)};+draft/reply=target :alice!a@host TAGMSG #chan`);
      expect(shown().find((message) => message.msgid === 'target')?.reactions).toEqual([{ emoji, nicks: ['alice'] }]);
      useChannelsStore.getState().setClearAll();
      useChannelsStore.getState().setAddChannel('#chan', ChannelCategory.channel);
    }));
  });

  it('a reply to anything, or to a message never seen, is shown without throwing', () => {
    fc.assert(fc.property(fc.string({ unit: 'binary', maxLength: 40 }), someText, (replyTo, text) => {
      expect(() => handle(`@+draft/reply=${escapeTagValue(replyTo)} :alice!a@host PRIVMSG #chan :${text}`)).not.toThrow();
    }));
  });

  it('a CTCP answer someone sends is shown without its control characters, and never throws', () => {
    fc.assert(fc.property(fc.constantFrom('VERSION', 'TIME', 'PING', 'CLIENTINFO', 'FINGER'), lineText, (command, answer) => {
      expect(() => handle(`:alice!a@host NOTICE me :\x01${command} ${answer}\x01`)).not.toThrow();
      for (const message of getMessages(useSettingsStore.getState().currentChannelName)) {
        expect(message.message).not.toContain('\x01');
      }
    }));
  });
});
