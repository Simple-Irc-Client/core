import { create } from 'zustand';
import { type UserTypingStatus, type Channel, ChannelCategory, type Message, type ChannelExtended } from '@shared/types';
import { devtools, persist } from 'zustand/middleware';
import { DEBUG_CHANNEL, maxMessages, STATUS_CHANNEL } from '@/config/config';
import { getCaseMapping, getChannelTypes, getCurrentChannelName, isSameName, setCurrentChannelName, syncCurrentUsers } from '@features/settings/store/settings';
import { useCurrentStore } from '@features/chat/store/current';
import { createServerScopedStorage } from '@shared/lib/idbStorage';
import { foldName } from '@shared/lib/caseMapping';

const updateChannelInBothLists = <T extends { name: string }>(
  list: T[],
  channelName: string,
  updater: (channel: T) => T,
): T[] => list.map((channel) => (isSameName(channel.name, channelName) ? updater(channel) : channel));

interface ChannelsStore {
  openChannels: ChannelExtended[];
  openChannelsShortList: Channel[];

  setAddChannel: (channelName: string, category: ChannelCategory) => void;
  setRemoveChannel: (channelName: string) => void;
  /** Adopt a different casing for an already open channel (the server is authoritative) */
  setRenameChannel: (from: string, to: string) => void;
  setTopic: (channelName: string, newTopic: string) => void;
  setTopicSetBy: (channelName: string, nick: string, when: number) => void;
  setAddMessage: (newMessage: Message) => void;
  /** Patch a message already in the list, keeping its position (E2EE decryption) */
  setUpdateMessage: (channelName: string, messageId: string, patch: Partial<Message>) => void;
  /** IRCv3 message-tags (typing) */
  setTyping: (channelName: string, nick: string, status: UserTypingStatus) => void;
  setClearAllTyping: () => void;
  setClearUnreadMessages: (channelName: string) => void;
  setIncreaseUnreadMessages: (channelName: string) => void;
  setHasMention: (channelName: string) => void;
  /** IRCv3 METADATA */
  setChannelAvatar: (channelName: string, avatar: string) => void;
  /** IRCv3 METADATA */
  setChannelDisplayName: (channelName: string, displayName: string) => void;
  setClearMessages: (channelName: string) => void;
  setClearAll: () => void;
}

const syncCurrentAfterHydration = (): void => {
  const currentChannelName = getCurrentChannelName();
  const state = useChannelsStore.getState();
  const channel = state.openChannels.find((ch) => isSameName(ch.name, currentChannelName));
  if (channel) {
    useCurrentStore.getState().setUpdateMessages([...channel.messages]);
    useCurrentStore.getState().setUpdateTopic(channel.topic);
    useCurrentStore.getState().setUpdateTyping([]);
    syncCurrentUsers();
  }
};

/**
 * Before channel names were compared case-insensitively, a window opened as
 * `#religie` and the server's canonical `#Religie` were persisted as two
 * separate channels — one collecting the chat, the other only the broadcast
 * system messages, and neither removable in one go.
 *
 * Folding with `ascii` rather than the server's actual CASEMAPPING is
 * deliberate: names equal under `ascii` are equal under every mapping, so the
 * merge can never join two channels the server considers distinct.
 */
const mergeCaseDuplicates = <T extends { name?: unknown }>(
  channels: unknown,
  merge: (existing: T, duplicate: T) => T,
): T[] => {
  if (!Array.isArray(channels)) {
    return [];
  }

  const byFoldedName = new Map<string, T>();

  for (const channel of channels as T[]) {
    if (channel === null || typeof channel !== 'object' || typeof channel.name !== 'string') {
      continue;
    }

    const key = foldName(channel.name, 'ascii');
    const existing = byFoldedName.get(key);
    byFoldedName.set(key, existing === undefined ? channel : merge(existing, channel));
  }

  return [...byFoldedName.values()];
};

const mergeMessages = (existing: Message[], duplicate: Message[]): Message[] => {
  const seenIds = new Set(existing.map((message) => message.id));

  return [...existing, ...duplicate.filter((message) => !seenIds.has(message.id))]
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
    .slice(-maxMessages);
};

/**
 * Drop what must never reach IndexedDB from a channel before it is persisted.
 *
 * Typing lists are merely transient. End-to-end encrypted messages are a
 * deliberate exclusion: session keys are ephemeral by design, so writing the
 * decrypted text to disk would leave plaintext behind that outlives the
 * conversation's forward secrecy — the one thing an encrypted DM is supposed to
 * prevent. Encrypted history therefore lives only as long as the tab does.
 *
 * The identity comparison at the end matters for performance: `partialize` runs
 * on every store mutation, and returning the original object when nothing needs
 * stripping keeps the common case allocation-free.
 */
const stripUnpersisted = (channel: ChannelExtended): ChannelExtended => {
  const hasTyping = channel.typing.length > 0;
  const hasEncrypted = channel.messages.some((message) => message.e2ee !== undefined);

  if (!hasTyping && !hasEncrypted) {
    return channel;
  }

  return {
    ...channel,
    ...(hasTyping ? { typing: [] as string[] } : {}),
    ...(hasEncrypted ? { messages: channel.messages.filter((message) => message.e2ee === undefined) } : {}),
  };
};

export const migrateChannels = (persisted: unknown, version: number): ChannelsStore => {
  const state = persisted as ChannelsStore;

  if (version < 2) {
    return {
      ...state,
      openChannels: mergeCaseDuplicates<ChannelExtended>(state?.openChannels, (existing, duplicate) => ({
        ...existing,
        messages: mergeMessages(existing.messages ?? [], duplicate.messages ?? []),
        // An empty topic means we never received one for that window, so the
        // other one's topic (and who set it) is the better information
        ...(existing.topic ? {} : { topic: duplicate.topic, topicSetBy: duplicate.topicSetBy, topicSetTime: duplicate.topicSetTime }),
        unReadMessages: (existing.unReadMessages ?? 0) + (duplicate.unReadMessages ?? 0),
        hasMention: existing.hasMention === true || duplicate.hasMention === true,
        avatar: existing.avatar ?? duplicate.avatar,
        displayName: existing.displayName ?? duplicate.displayName,
        typing: [],
      })),
      openChannelsShortList: mergeCaseDuplicates<Channel>(state?.openChannelsShortList, (existing, duplicate) => ({
        ...existing,
        unReadMessages: (existing.unReadMessages ?? 0) + (duplicate.unReadMessages ?? 0),
        hasMention: existing.hasMention === true || duplicate.hasMention === true,
        avatar: existing.avatar ?? duplicate.avatar,
        displayName: existing.displayName ?? duplicate.displayName,
      })),
    };
  }

  return state;
};

export const useChannelsStore = create<ChannelsStore>()(
  devtools(
    persist(
      (set) => ({
    openChannels: [],
    openChannelsShortList: [],

    setAddChannel: (channelName: string, category: ChannelCategory): void => {
      set((state) => ({
        openChannelsShortList: [...state.openChannelsShortList, { category, name: channelName, unReadMessages: 0 }],
        openChannels: [
          ...state.openChannels,
          {
            category,
            messages: [],
            name: channelName,
            topic: '',
            topicSetBy: '',
            topicSetTime: 0,
            unReadMessages: 0,
            typing: [],
          },
        ],
      }));
    },
    setRemoveChannel: (channelName: string) => {
      set((state) => ({
        openChannelsShortList: state.openChannelsShortList.filter((channel) => !isSameName(channel.name, channelName)),
        openChannels: state.openChannels.filter((channel) => !isSameName(channel.name, channelName)),
      }));
    },
    setRenameChannel: (from: string, to: string) => {
      set((state) => ({
        openChannelsShortList: updateChannelInBothLists(state.openChannelsShortList, from, (ch) => ({ ...ch, name: to })),
        openChannels: updateChannelInBothLists(state.openChannels, from, (ch) => ({
          ...ch,
          name: to,
          // Messages carry the window they belong to; leaving the old casing
          // behind would strand them if anything ever re-routes by target
          messages: ch.messages.map((message) => (isSameName(message.target, from) ? { ...message, target: to } : message)),
        })),
      }));
    },
    setTopic: (channelName: string, newTopic: string) => {
      set((state) => ({
        openChannels: state.openChannels.map((channel: ChannelExtended) => {
          if (!isSameName(channel.name, channelName)) {
            return channel;
          }

          return { ...channel, topic: newTopic };
        }),
      }));
    },
    setTopicSetBy: (channelName: string, nick: string, when: number) => {
      set((state) => ({
        openChannels: state.openChannels.map((channel: ChannelExtended) => {
          if (!isSameName(channel.name, channelName)) {
            return channel;
          }

          return { ...channel, topicSetBy: nick, topicSetTime: when };
        }),
      }));
    },
    setAddMessage: (newMessage: Message): void => {
      set((state) => ({
        openChannels: state.openChannels.map((channel: ChannelExtended) => {
          if (!isSameName(channel.name, newMessage.target)) {
            return channel;
          }

          // Dedup: skip if message with same id already exists (e.g. chathistory overlapping with real-time)
          if (channel.messages.some((m) => m.id === newMessage.id)) {
            return channel;
          }

          const messages = [...channel.messages, newMessage];
          if (messages.length > maxMessages) {
            messages.shift();
          }
          return { ...channel, messages };
        }),
      }));
    },
    setUpdateMessage: (channelName: string, messageId: string, patch: Partial<Message>): void => {
      set((state) => ({
        openChannels: state.openChannels.map((channel: ChannelExtended) => {
          if (!isSameName(channel.name, channelName)) {
            return channel;
          }

          const index = channel.messages.findIndex((message) => message.id === messageId);
          if (index === -1) {
            return channel;
          }

          const messages = [...channel.messages];
          messages[index] = { ...messages[index], ...patch } as Message;
          return { ...channel, messages };
        }),
      }));
    },
    setTyping: (channelName: string, nick: string, status: UserTypingStatus) => {
      set((state) => ({
        openChannels: state.openChannels.map((channel: ChannelExtended) => {
          if (!isSameName(channel.name, channelName)) {
            return channel;
          }

          let typing: string[];
          switch (status) {
            case 'done':
              typing = channel.typing.filter((typingNick) => typingNick !== nick);
              break;
            case 'active':
            case 'paused':
              typing = channel.typing.includes(nick) ? channel.typing : [...channel.typing, nick];
              break;
            default:
              typing = channel.typing;
          }

          return { ...channel, typing };
        }),
      }));
    },
    setClearAllTyping: () => {
      set((state) => ({
        openChannels: state.openChannels.map((channel) =>
          channel.typing.length > 0 ? { ...channel, typing: [] } : channel,
        ),
      }));
    },
    setClearUnreadMessages: (channelName: string) => {
      set((state) => ({
        openChannelsShortList: updateChannelInBothLists(state.openChannelsShortList, channelName, (ch) => ({ ...ch, unReadMessages: 0, hasMention: false })),
        openChannels: updateChannelInBothLists(state.openChannels, channelName, (ch) => ({ ...ch, unReadMessages: 0, hasMention: false })),
      }));
    },
    setIncreaseUnreadMessages: (channelName: string) => {
      set((state) => ({
        openChannelsShortList: updateChannelInBothLists(state.openChannelsShortList, channelName, (ch) => ({ ...ch, unReadMessages: ch.unReadMessages + 1 })),
        openChannels: updateChannelInBothLists(state.openChannels, channelName, (ch) => ({ ...ch, unReadMessages: ch.unReadMessages + 1 })),
      }));
    },
    setHasMention: (channelName: string) => {
      set((state) => ({
        openChannelsShortList: updateChannelInBothLists(state.openChannelsShortList, channelName, (ch) => ({ ...ch, hasMention: true })),
        openChannels: updateChannelInBothLists(state.openChannels, channelName, (ch) => ({ ...ch, hasMention: true })),
      }));
    },
    setChannelAvatar: (channelName: string, avatar: string) => {
      set((state) => ({
        openChannelsShortList: updateChannelInBothLists(state.openChannelsShortList, channelName, (ch) => ({ ...ch, avatar })),
        openChannels: updateChannelInBothLists(state.openChannels, channelName, (ch) => ({ ...ch, avatar })),
      }));
    },
    setChannelDisplayName: (channelName: string, displayName: string) => {
      set((state) => ({
        openChannelsShortList: updateChannelInBothLists(state.openChannelsShortList, channelName, (ch) => ({ ...ch, displayName })),
        openChannels: updateChannelInBothLists(state.openChannels, channelName, (ch) => ({ ...ch, displayName })),
      }));
    },
    setClearMessages: (channelName: string) => {
      set((state) => ({
        openChannels: state.openChannels.map((channel) => {
          if (!isSameName(channel.name, channelName)) {
            return channel;
          }
          return { ...channel, messages: [] };
        }),
      }));
    },
    setClearAll: () => {
      set(() => ({
        openChannels: [],
        openChannelsShortList: [],
      }));
    },
  }),
      {
        name: 'sic-channels',
        version: 3,
        migrate: migrateChannels,
        storage: createServerScopedStorage<ChannelsStore>(),
        // Runs on every mutation, so channels are only copied when they actually
        // carry something to strip: a transient typing list, or end-to-end
        // encrypted messages.
        partialize: (state) => ({
          openChannels: state.openChannels.map((ch) => stripUnpersisted(ch)),
          openChannelsShortList: state.openChannelsShortList,
        }) as unknown as ChannelsStore,
        onRehydrateStorage: () => {
          return (state, error) => {
            if (error) {
              console.warn('Channels store rehydration failed:', error);
              return;
            }
            if (state) {
              syncCurrentAfterHydration();
            }
          };
        },
      },
    ),
  ),
);

export const setAddChannel = (channelName: string, category: ChannelCategory): void => {
  if (!existChannel(channelName)) {
    useChannelsStore.getState().setAddChannel(channelName, category);
  }
};

export const setRemoveChannel = (channelName: string): void => {
  useChannelsStore.getState().setRemoveChannel(channelName);
};

export const getChannel = (channelName: string): ChannelExtended | undefined => {
  return useChannelsStore.getState().openChannels.find((channel: ChannelExtended) => isSameName(channel.name, channelName));
};

export const existChannel = (channelName: string): boolean => {
  return getChannel(channelName) !== undefined;
};

/**
 * Adopt the server's casing for a channel we already have open. Servers echo a
 * channel's canonical name, which may differ from what the user typed or what
 * we restored from storage; without this the two casings drift apart in the UI.
 */
export const setRenameChannel = (from: string, to: string): void => {
  if (from === to || !existChannel(from)) {
    return;
  }

  useChannelsStore.getState().setRenameChannel(from, to);

  const currentChannelName = getCurrentChannelName();
  if (isSameName(currentChannelName, to)) {
    setCurrentChannelName(to, getCategory(to) ?? ChannelCategory.channel);
  }
};

export const getChannelsToAutoJoin = (): string[] => {
  const channels = useChannelsStore.getState().openChannelsShortList
    .filter((ch) => ch.category === ChannelCategory.channel)
    .map((ch) => ch.name);
  return channels.length > 0 ? channels : lastChannelsToAutoJoin;
};

export const setTopic = (channelName: string, newTopic: string): void => {
  useChannelsStore.getState().setTopic(channelName, newTopic);

  const currentChannelName = getCurrentChannelName();

  if (isSameName(currentChannelName, channelName)) {
    useCurrentStore.getState().setUpdateTopic(newTopic);
  }
};

export const getTopic = (channelName: string): string => {
  return getChannel(channelName)?.topic ?? '';
};

export const setTopicSetBy = (channelName: string, nick: string, when: number): void => {
  useChannelsStore.getState().setTopicSetBy(channelName, nick, when);
};

export const getTopicSetBy = (channelName: string): string => {
  return getChannel(channelName)?.topicSetBy ?? '';
};

export const getTopicTime = (channelName: string): number => {
  return getChannel(channelName)?.topicSetTime ?? 0;
};

export const setAddMessage = (newMessage: Message): void => {
  if (!existChannel(newMessage.target)) {
    let category;
    if (isSameName(newMessage.target, DEBUG_CHANNEL)) {
      category = ChannelCategory.debug;
    } else if (isSameName(newMessage.target, STATUS_CHANNEL)) {
      category = ChannelCategory.status;
    } else {
      category = isPriv(newMessage.target) ? ChannelCategory.priv : ChannelCategory.channel;
    }

    useChannelsStore.getState().setAddChannel(newMessage.target, category);
  }

  useChannelsStore.getState().setAddMessage(newMessage);

  const currentChannelName = getCurrentChannelName();

  if (isSameName(currentChannelName, newMessage.target)) {
    useCurrentStore.getState().setUpdateMessages(getMessages(newMessage.target));
  }
};

/**
 * Patch a message that is already in the list, leaving its position untouched.
 *
 * Used by the E2EE receive path: the kernel inserts a placeholder synchronously
 * so arrival order is preserved, then replaces the body once the asynchronous
 * decryption resolves.
 */
export const setUpdateMessage = (channelName: string, messageId: string, patch: Partial<Message>): void => {
  useChannelsStore.getState().setUpdateMessage(channelName, messageId, patch);

  if (isSameName(getCurrentChannelName(), channelName)) {
    useCurrentStore.getState().setUpdateMessages(getMessages(channelName));
  }
};

export const setAddMessageToAllChannels = (newMessage: Omit<Message, 'target'>): void => {
  const channels = useChannelsStore.getState().openChannels;
  const currentChannelName = getCurrentChannelName();

  for (const channel of channels) {
    useChannelsStore.getState().setAddMessage({ ...newMessage, target: channel.name });

    if (isSameName(currentChannelName, channel.name)) {
      useCurrentStore.getState().setUpdateMessages(getMessages(currentChannelName));
    }
  }
};

export const getMessages = (channelName: string): Message[] => {
  return [...(getChannel(channelName)?.messages ?? [])];
};

export const setClearMessages = (channelName: string): void => {
  useChannelsStore.getState().setClearMessages(channelName);
  const currentChannelName = getCurrentChannelName();
  if (isSameName(currentChannelName, channelName)) {
    useCurrentStore.getState().setUpdateMessages([]);
  }
};

export const getCategory = (channelName: string): ChannelCategory | undefined => {
  return getChannel(channelName)?.category ?? undefined;
};

// Typing indicators go stale without a 'done' if the sender's client dies mid-typing;
// the typing spec mandates expiring 'active' after 6s and 'paused' after 30s of silence
const TYPING_EXPIRY_MS: Partial<Record<UserTypingStatus, number>> = {
  active: 6_000,
  paused: 30_000,
};

const typingExpiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Folded so a timer armed for #Religie is found again when the 'done' arrives for #religie
const typingExpiryKey = (channelName: string, nick: string): string => {
  const mapping = getCaseMapping();
  // U+0000 cannot occur in a channel name or nick, so it separates the two halves unambiguously
  return `${foldName(channelName, mapping)}\u0000${foldName(nick, mapping)}`;
};

const clearTypingExpiry = (channelName: string, nick: string): void => {
  const key = typingExpiryKey(channelName, nick);
  const timer = typingExpiryTimers.get(key);
  if (timer !== undefined) {
    clearTimeout(timer);
    typingExpiryTimers.delete(key);
  }
};

export const clearAllTypingExpiry = (): void => {
  for (const timer of typingExpiryTimers.values()) {
    clearTimeout(timer);
  }
  typingExpiryTimers.clear();
};

export const setTyping = (channelName: string, nick: string, status: UserTypingStatus): void => {
  clearTypingExpiry(channelName, nick);

  const expiryMs = TYPING_EXPIRY_MS[status];
  if (expiryMs !== undefined) {
    typingExpiryTimers.set(typingExpiryKey(channelName, nick), setTimeout(() => {
      typingExpiryTimers.delete(typingExpiryKey(channelName, nick));
      setTyping(channelName, nick, 'done');
    }, expiryMs));
  }

  useChannelsStore.getState().setTyping(channelName, nick, status);

  const currentChannelName = getCurrentChannelName();

  if (isSameName(currentChannelName, channelName)) {
    useCurrentStore.getState().setUpdateTyping(getTyping(channelName));
  }
};

export const getTyping = (channelName: string): string[] => {
  return getChannel(channelName)?.typing ?? [];
};

export const existTyping = (channelName: string, nick: string): boolean => {
  return getTyping(channelName).includes(nick);
};

export const clearTyping = (channelName: string, nick: string): void => {
  if (existTyping(channelName, nick)) {
    setTyping(channelName, nick, 'done');
  }
};

export const clearAllTyping = (): void => {
  clearAllTypingExpiry();
  useChannelsStore.getState().setClearAllTyping();
  useCurrentStore.getState().setUpdateTyping([]);
};

export const setClearUnreadMessages = (channelName: string): void => {
  useChannelsStore.getState().setClearUnreadMessages(channelName);
};

export const setIncreaseUnreadMessages = (channelName: string): void => {
  useChannelsStore.getState().setIncreaseUnreadMessages(channelName);
};

export const setHasMention = (channelName: string): void => {
  useChannelsStore.getState().setHasMention(channelName);
};

export const setChannelAvatar = (channelName: string, avatar: string): void => {
  useChannelsStore.getState().setChannelAvatar(channelName, avatar);
};

export const setChannelDisplayName = (channelName: string, displayName: string): void => {
  useChannelsStore.getState().setChannelDisplayName(channelName, displayName);
};

export const isPriv = (channelName: string): boolean => {
  const char = channelName?.[0];
  if (char === undefined) {
    return false;
  }
  return !getChannelTypes().includes(char);
};

export const isChannel = (channelName: string): boolean => {
  const char = channelName?.[0];
  if (char === undefined) {
    return false;
  }
  return getChannelTypes().includes(char);
};

let lastChannelsToAutoJoin: string[] = [];

export const setChannelsClearAll = (): void => {
  lastChannelsToAutoJoin = getChannelsToAutoJoin();
  clearAllTypingExpiry();
  useChannelsStore.getState().setClearAll();
};

