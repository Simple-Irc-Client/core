import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ChannelCategory, MessageCategory, type Channel, type ChannelExtended, type Message } from '@shared/types';
import { type NetworkStorage } from '@shared/lib/idbStorage';
import { activateNetwork, deactivateNetwork } from '@features/networks/store/networks';
import { getChannel, getMessages, setAddChannel, setAddMessage, setTyping, useChannelsStore, type ChannelsSlice } from '../channels';
import { mergeLoadedChannels, migrateChannels, startChannelsPersistence, toSavedChannels } from '../channelsPersistence';
import { clearTestSlices, connectTestNetwork, resetNetworks, setTestSlice, testSlice, TEST_SERVER } from '@/test/networks';

vi.mock('@/network/irc/readMarkers', () => ({
  markRead: vi.fn(),
}));

interface SavedChannels {
  state: ChannelsSlice;
  version: number;
}

/** IndexedDB as a map, written at once */
const createMemoryStorage = (initial: Record<string, SavedChannels> = {}) => {
  const values = new Map(Object.entries(initial));
  const storage: NetworkStorage<SavedChannels> = {
    load: (networkId) => Promise.resolve(values.get(`sic-channels:${networkId}`)),
    loadKey: (key) => Promise.resolve(values.get(key)),
    save: (networkId, value) => { values.set(`sic-channels:${networkId}`, value); },
    saveNow: (networkId, value) => { values.set(`sic-channels:${networkId}`, value); return Promise.resolve(); },
    removeKey: (key) => { values.delete(key); return Promise.resolve(); },
    dispose: () => {},
  };
  return { storage, values };
};

const createMessageAt = (id: string, message: string, target: string, time: string): Message => ({
  id,
  message,
  target,
  time,
  category: MessageCategory.default,
});

const createMessage = (id: string, message: string, target: string): Message => createMessageAt(id, message, target, new Date().toISOString());

const savedWindows = (channels: string[], messages: Message[] = []): SavedChannels => ({
  state: {
    openChannels: channels.map((name) => ({ name, category: ChannelCategory.channel, messages: messages.filter((message) => message.target === name), topic: '', topicSetBy: '', topicSetTime: 0, unReadMessages: 0, typing: [] })),
    openChannelsShortList: channels.map((name) => ({ name, category: ChannelCategory.channel, unReadMessages: 0 })),
  },
  version: 3,
});

const OTHER_SERVER = { default: 0, encoding: 'utf8', network: 'OtherNet', servers: ['irc.other.net'] };

describe('channels persistence', () => {
  let stop: (() => void) | undefined;

  beforeEach(() => {
    resetNetworks();
    clearTestSlices(useChannelsStore);
  });

  afterEach(() => {
    stop?.();
    stop = undefined;
  });

  const start = (initial: Record<string, SavedChannels> = {}) => {
    const memory = createMemoryStorage(initial);
    const persistence = startChannelsPersistence(memory.storage);
    stop = persistence.stop;
    return { ...memory, persistence };
  };

  describe('loading', () => {
    it('loads a network\'s saved windows once it becomes the active one', async () => {
      const { persistence } = start({ 'sic-channels:TestNet': savedWindows(['#saved']) });

      connectTestNetwork();
      await persistence.loadNetwork('TestNet');

      expect(getChannel('#saved')).toBeDefined();
    });

    it('loads the active network\'s windows on start', async () => {
      connectTestNetwork();
      const { persistence } = start({ 'sic-channels:TestNet': savedWindows(['#saved']) });

      await persistence.loadNetwork('TestNet');

      expect(getChannel('#saved')).toBeDefined();
    });

    it('keeps each network\'s windows apart', async () => {
      const { persistence } = start({ 'sic-channels:TestNet': savedWindows(['#test']), 'sic-channels:OtherNet': savedWindows(['#other']) });

      activateNetwork(OTHER_SERVER, 'alice');
      await persistence.loadNetwork('OtherNet');

      expect(getChannel('#other')).toBeDefined();
      expect(getChannel('#test')).toBeUndefined();
    });

    it('adds the saved windows to those opened while they were loading', async () => {
      const { persistence } = start({ 'sic-channels:TestNet': savedWindows(['#saved'], [createMessageAt('old', 'before', '#saved', '2026-10-01T10:00:00.000Z')]) });
      connectTestNetwork();
      setAddChannel('#saved', ChannelCategory.channel);
      setAddChannel('#new', ChannelCategory.channel);
      setAddMessage(createMessageAt('live', 'after', '#saved', '2026-10-02T10:00:00.000Z'));

      await persistence.loadNetwork('TestNet');

      expect(testSlice(useChannelsStore).openChannelsShortList.map((channel) => channel.name)).toEqual(['#saved', '#new']);
      expect(getMessages('#saved').map((message) => message.id)).toEqual(['old', 'live']);
    });

    it('adopts the windows an older version saved per server, and drops the older keys', async () => {
      const legacyKey = 'sic-channels:TestNet:irc.test.net';
      const { persistence, values } = start({ [legacyKey]: savedWindows(['#legacy']), 'sic-channels:TestNet:irc2.test.net': savedWindows(['#other-server']) });
      activateNetwork({ ...TEST_SERVER, servers: ['irc.test.net', 'irc2.test.net'] }, 'alice');

      await persistence.loadNetwork('TestNet');

      expect(getChannel('#legacy')).toBeDefined();
      expect(values.get('sic-channels:TestNet')?.state.openChannelsShortList.map((channel) => channel.name)).toEqual(['#legacy']);
      expect(values.has(legacyKey)).toBe(false);
      expect(values.has('sic-channels:TestNet:irc2.test.net')).toBe(false);
    });

    it('adopts the windows an older version saved for a network on a bouncer', async () => {
      const bouncerServer = { ...TEST_SERVER, network: 'soju', servers: ['soju.example:6697'], bouncer: { account: 'alice', encryptedPassword: 'x', networkId: '7' } };
      const { persistence } = start({ 'sic-channels:soju:soju.example:6697:7': savedWindows(['#libera']) });
      activateNetwork(bouncerServer, 'alice');

      await persistence.loadNetwork('soju/bouncer:7');

      expect(getChannel('#libera')).toBeDefined();
    });
  });

  describe('saving', () => {
    it('saves a network\'s windows under its own key once they are loaded', async () => {
      const { persistence, values } = start();
      connectTestNetwork();
      await persistence.loadNetwork('TestNet');

      setAddChannel('#chat', ChannelCategory.channel);

      expect(values.get('sic-channels:TestNet')?.state.openChannelsShortList.map((channel) => channel.name)).toEqual(['#chat']);
    });

    it('saves the windows opened while a network with nothing saved was loading', async () => {
      const { persistence, values } = start();
      connectTestNetwork();
      setAddChannel('#early', ChannelCategory.channel);

      await persistence.loadNetwork('TestNet');

      expect(values.get('sic-channels:TestNet')?.state.openChannelsShortList.map((channel) => channel.name)).toEqual(['#early']);
    });

    it('does not overwrite saved windows before they are loaded', () => {
      const { values } = start({ 'sic-channels:TestNet': savedWindows(['#saved']) });
      connectTestNetwork();

      setAddChannel('#early', ChannelCategory.channel);

      expect(values.get('sic-channels:TestNet')?.state.openChannelsShortList.map((channel) => channel.name)).toEqual(['#saved']);
    });

    it('never saves the windows from before a network is chosen', () => {
      const { values } = start();
      deactivateNetwork();

      setAddChannel('Status', ChannelCategory.status);

      expect([...values.keys()]).toEqual([]);
    });
  });

  describe('mergeLoadedChannels', () => {
    it('takes what was learned since the load, with the messages of both', () => {
      connectTestNetwork();
      const saved = savedWindows(['#chat'], [createMessageAt('a', 'old', '#chat', '2026-10-01T10:00:00.000Z')]).state;
      const live: ChannelsSlice = {
        openChannels: [{ ...saved.openChannels[0] as ChannelExtended, topic: 'new topic', messages: [createMessageAt('b', 'new', '#chat', '2026-10-02T10:00:00.000Z')] }],
        openChannelsShortList: [{ name: '#Chat', category: ChannelCategory.channel, unReadMessages: 3 }],
      };

      const merged = mergeLoadedChannels(saved, live);

      expect(merged.openChannels[0]?.topic).toBe('new topic');
      expect(merged.openChannels[0]?.messages.map((message) => message.id)).toEqual(['a', 'b']);
      expect(merged.openChannelsShortList).toEqual([{ name: '#Chat', category: ChannelCategory.channel, unReadMessages: 3 }]);
    });
  });

  describe('migrateChannels', () => {
    const channel = (name: string, overrides: Partial<ChannelExtended> = {}): ChannelExtended => ({
      name,
      category: ChannelCategory.channel,
      messages: [],
      topic: '',
      topicSetBy: '',
      topicSetTime: 0,
      unReadMessages: 0,
      typing: [],
      ...overrides,
    });

    const shortListChannel = (name: string, overrides: Partial<Channel> = {}): Channel => ({
      name,
      category: ChannelCategory.channel,
      unReadMessages: 0,
      ...overrides,
    });

    it('should merge case-duplicate channels into one window', () => {
      const migrated = migrateChannels({
        openChannels: [channel('#religie'), channel('#Religie')],
        openChannelsShortList: [shortListChannel('#religie'), shortListChannel('#Religie')],
      }, 1);

      expect(migrated.openChannels.length).toBe(1);
      expect(migrated.openChannelsShortList.length).toBe(1);
    });

    it('should keep the first name so a later JOIN can correct it', () => {
      const migrated = migrateChannels({
        openChannels: [channel('#religie'), channel('#Religie')],
        openChannelsShortList: [],
      }, 1);

      expect(migrated.openChannels[0]?.name).toBe('#religie');
    });

    it('should interleave the messages of both windows by time', () => {
      const migrated = migrateChannels({
        openChannels: [
          channel('#religie', { messages: [
            createMessageAt('sys-1', 'connected', '#religie', '2026-07-30T10:00:00.000Z'),
            createMessageAt('sys-2', 'connected', '#religie', '2026-07-30T12:00:00.000Z'),
          ] }),
          channel('#Religie', { messages: [
            createMessageAt('chat-1', 'hello', '#Religie', '2026-07-30T11:00:00.000Z'),
          ] }),
        ],
        openChannelsShortList: [],
      }, 1);

      expect(migrated.openChannels[0]?.messages.map((message) => message.id)).toEqual(['sys-1', 'chat-1', 'sys-2']);
    });

    it('should drop messages that both windows already hold', () => {
      const migrated = migrateChannels({
        openChannels: [
          channel('#religie', { messages: [createMessage('same', 'hello', '#religie')] }),
          channel('#Religie', { messages: [createMessage('same', 'hello', '#Religie')] }),
        ],
        openChannelsShortList: [],
      }, 1);

      expect(migrated.openChannels[0]?.messages.length).toBe(1);
    });

    it('should cap the merged history at maxMessages', () => {
      const many = (prefix: string, count: number): Message[] =>
        Array.from({ length: count }, (_, index) => createMessageAt(`${prefix}-${index}`, 'm', '#religie', `2026-07-30T10:00:${String(index % 60).padStart(2, '0')}.000Z`));

      const migrated = migrateChannels({
        openChannels: [
          channel('#religie', { messages: many('a', 250) }),
          channel('#Religie', { messages: many('b', 250) }),
        ],
        openChannelsShortList: [],
      }, 1);

      expect(migrated.openChannels[0]?.messages.length).toBe(300);
    });

    it('should carry over the topic from the window that has one', () => {
      const migrated = migrateChannels({
        openChannels: [
          channel('#religie'),
          channel('#Religie', { topic: 'the topic', topicSetBy: 'op', topicSetTime: 42 }),
        ],
        openChannelsShortList: [],
      }, 1);

      expect(migrated.openChannels[0]?.topic).toBe('the topic');
      expect(migrated.openChannels[0]?.topicSetBy).toBe('op');
      expect(migrated.openChannels[0]?.topicSetTime).toBe(42);
    });

    it('should keep the topic of the first window when both have one', () => {
      const migrated = migrateChannels({
        openChannels: [
          channel('#religie', { topic: 'first' }),
          channel('#Religie', { topic: 'second' }),
        ],
        openChannelsShortList: [],
      }, 1);

      expect(migrated.openChannels[0]?.topic).toBe('first');
    });

    it('should add up the unread counts and keep a mention from either window', () => {
      const migrated = migrateChannels({
        openChannels: [
          channel('#religie', { unReadMessages: 2 }),
          channel('#Religie', { unReadMessages: 3, hasMention: true }),
        ],
        openChannelsShortList: [
          shortListChannel('#religie', { unReadMessages: 2 }),
          shortListChannel('#Religie', { unReadMessages: 3, hasMention: true }),
        ],
      }, 1);

      expect(migrated.openChannels[0]?.unReadMessages).toBe(5);
      expect(migrated.openChannels[0]?.hasMention).toBe(true);
      expect(migrated.openChannelsShortList[0]?.unReadMessages).toBe(5);
      expect(migrated.openChannelsShortList[0]?.hasMention).toBe(true);
    });

    it('should keep metadata from whichever window carries it', () => {
      const migrated = migrateChannels({
        openChannels: [
          channel('#religie'),
          channel('#Religie', { avatar: 'https://avatar.png', displayName: 'Religie' }),
        ],
        openChannelsShortList: [],
      }, 1);

      expect(migrated.openChannels[0]?.avatar).toBe('https://avatar.png');
      expect(migrated.openChannels[0]?.displayName).toBe('Religie');
    });

    it('should drop stale typing state', () => {
      const migrated = migrateChannels({
        openChannels: [
          channel('#religie', { typing: ['someone'] }),
          channel('#Religie', { typing: ['other'] }),
        ],
        openChannelsShortList: [],
      }, 1);

      expect(migrated.openChannels[0]?.typing).toEqual([]);
    });

    it('should merge DM windows for the same nick', () => {
      const migrated = migrateChannels({
        openChannels: [
          channel('Merovingian', { category: ChannelCategory.priv }),
          channel('merovingian', { category: ChannelCategory.priv }),
        ],
        openChannelsShortList: [],
      }, 1);

      expect(migrated.openChannels.length).toBe(1);
    });

    it('should leave channels that only differ outside ASCII alone', () => {
      // ascii folding is the conservative choice: it must never join two
      // channels a server with another CASEMAPPING considers distinct
      const migrated = migrateChannels({
        openChannels: [channel('#a[b]'), channel('#a{b}')],
        openChannelsShortList: [],
      }, 1);

      expect(migrated.openChannels.length).toBe(2);
    });

    it('should leave an already migrated state untouched', () => {
      const state = { openChannels: [channel('#religie'), channel('#Religie')], openChannelsShortList: [] };

      const migrated = migrateChannels(state, 2);

      expect(migrated.openChannels.length).toBe(2);
    });

    it('should survive persisted state that is missing or malformed', () => {
      expect(migrateChannels({}, 1).openChannels).toEqual([]);
      expect(migrateChannels({ openChannels: 'nonsense' }, 1).openChannels).toEqual([]);
      expect(migrateChannels(undefined, 1).openChannels).toEqual([]);
      expect(migrateChannels({ openChannels: [null, 42, { noName: true }, channel('#ok')] }, 1).openChannels.length).toBe(1);
    });
  });


  describe('persistence of encrypted messages', () => {
    const saved = (): ChannelsSlice => toSavedChannels(testSlice(useChannelsStore));

    beforeEach(() => {
      setTestSlice(useChannelsStore, { openChannels: [], openChannelsShortList: [] });
      setAddChannel('bob', ChannelCategory.priv);
    });

    const message = (id: string, text: string, extra: Partial<Message> = {}): Message => ({
      id,
      message: text,
      target: 'bob',
      time: '2026-08-10T10:00:00.000Z',
      category: MessageCategory.default,
      ...extra,
    });

    it('should keep end-to-end encrypted messages out of storage', () => {
      setAddMessage(message('a', 'plaintext dm'));
      setAddMessage(message('b', 'secret', { e2ee: 'ok' }));
      setAddMessage(message('c', 'still decrypting', { e2ee: 'decrypting' }));
      setAddMessage(message('d', 'could not decrypt', { e2ee: 'failed' }));

      const persisted = saved();

      expect(persisted.openChannels[0]?.messages.map((entry) => entry.message)).toEqual(['plaintext dm']);
    });

    it('should not disturb the in-memory messages while persisting', () => {
      setAddMessage(message('a', 'plaintext dm'));
      setAddMessage(message('b', 'secret', { e2ee: 'ok' }));

      saved();

      expect(getMessages('bob')).toHaveLength(2);
    });

    it('should still strip the transient typing list', () => {
      setTyping('bob', 'someone', 'active');

      const persisted = saved();

      expect(persisted.openChannels[0]?.typing).toEqual([]);
    });

    it('should reuse the channel object when there is nothing to strip', () => {
      setAddMessage(message('a', 'plaintext dm'));
      const before = testSlice(useChannelsStore).openChannels[0];

      const persisted = saved();

      // Saving runs on every change, so the untouched case must not allocate
      expect(persisted.openChannels[0]).toBe(before);
    });
  });
});
