import { create } from 'zustand';
import { type UserTypingStatus, type Channel, ChannelCategory, type Message, type ChannelExtended } from '@shared/types';
import { devtools } from 'zustand/middleware';
import { DEBUG_CHANNEL, maxMessages, maxViewedMessages, STATUS_CHANNEL } from '@/config/config';
import { useCurrentStore } from '@features/chat/store/current';
import { foldName } from '@shared/lib/caseMapping';
import { activeSlice, updateActiveSlice, useActiveSlice, type NetworkSlices } from '@features/networks/store/networkSlices';
import { getCaseMapping, getChannelTypes, getCurrentChannelName, isSameName } from '@features/networks/store/networks';
import { setCurrentChannelName } from '@features/networks/currentChannel';

const updateChannelByName = <T extends { name: string }>(
  list: T[],
  channelName: string,
  updater: (channel: T) => T,
): T[] => list.map((channel) => (isSameName(channel.name, channelName) ? updater(channel) : channel));

/**
 * Places a chathistory page, in the server's order, among the messages already shown.
 * Messages the page shares with them, and the one it was asked for as older than (`beforeId`), pin its new ones in place;
 * elsewhere time decides, which can't order messages sharing a millisecond.
 */
export const mergeHistoryPage = (shown: Message[], page: Message[], beforeId?: string): Message[] => {
  const result = [...shown];
  const placedIds = new Set(shown.map((message) => message.id));
  const pinnedIds = new Set(page.filter((message) => placedIds.has(message.id)).map((message) => message.id));
  if (beforeId !== undefined) {
    pinnedIds.add(beforeId);
  }
  let cursor = 0;

  for (const message of page) {
    if (placedIds.has(message.id)) {
      cursor = Math.max(cursor, result.findIndex((placed) => placed.id === message.id) + 1);
      continue;
    }

    const time = Date.parse(message.time);
    const offset = result.slice(cursor).findIndex((placed) => pinnedIds.has(placed.id) || Date.parse(placed.time) > time);
    const index = offset === -1 ? result.length : cursor + offset;
    result.splice(index, 0, message);
    placedIds.add(message.id);
    cursor = index + 1;
  }

  return result;
};

const keepNewest = (messages: Message[], limit: number): Message[] => (messages.length > limit ? messages.slice(-limit) : messages);

export interface ChannelsSlice {
  openChannels: ChannelExtended[];
  openChannelsShortList: Channel[];
}

export const NO_CHANNELS: ChannelsSlice = { openChannels: [], openChannelsShortList: [] };

interface ChannelsStore extends NetworkSlices<ChannelsSlice> {
  setAddChannel: (channelName: string, category: ChannelCategory) => void;
  setRemoveChannel: (channelName: string) => void;
  /** Adopt a different casing for an already open channel (the server is authoritative) */
  setRenameChannel: (from: string, to: string) => void;
  setTopic: (channelName: string, newTopic: string) => void;
  setTopicSetBy: (channelName: string, nick: string, when: number) => void;
  /** The oldest beyond `limit` are dropped */
  setAddMessage: (newMessage: Message, limit: number) => void;
  /** A chathistory page, in the server's order, older than the message `beforeId` when given */
  setAddHistoryPage: (channelName: string, page: Message[], limit: number, beforeId?: string) => void;
  /** Patch a message already in the list, keeping its position (E2EE decryption) */
  setUpdateMessage: (channelName: string, messageId: string, patch: Partial<Message>) => void;
  /** IRCv3 message-tags (typing) */
  setTyping: (channelName: string, nick: string, status: UserTypingStatus) => void;
  setClearAllTyping: () => void;
  setClearUnreadMessages: (channelName: string) => void;
  setIncreaseUnreadMessages: (channelName: string) => void;
  /** Recounted from a read marker (IRCv3 draft/read-marker) */
  setUnreadMessages: (channelName: string, count: number, hasMention: boolean) => void;
  setHasMention: (channelName: string) => void;
  /** IRCv3 METADATA */
  setChannelAvatar: (channelName: string, avatar: string) => void;
  /** IRCv3 METADATA */
  setChannelDisplayName: (channelName: string, displayName: string) => void;
  setClearMessages: (channelName: string) => void;
  setClearAll: () => void;
}

export const useChannelsStore = create<ChannelsStore>()(
  devtools(
      (set) => ({
    byNetwork: {},
    emptySlice: NO_CHANNELS,

    setAddChannel: (channelName: string, category: ChannelCategory): void => {
      set((state) => updateActiveSlice(state, (slice) => ({
        openChannelsShortList: [...slice.openChannelsShortList, { category, name: channelName, unReadMessages: 0 }],
        openChannels: [
          ...slice.openChannels,
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
      })));
    },
    setRemoveChannel: (channelName: string) => {
      set((state) => updateActiveSlice(state, (slice) => ({
        openChannelsShortList: slice.openChannelsShortList.filter((channel) => !isSameName(channel.name, channelName)),
        openChannels: slice.openChannels.filter((channel) => !isSameName(channel.name, channelName)),
      })));
    },
    setRenameChannel: (from: string, to: string) => {
      set((state) => updateActiveSlice(state, (slice) => ({
        openChannelsShortList: updateChannelByName(slice.openChannelsShortList, from, (ch) => ({ ...ch, name: to })),
        openChannels: updateChannelByName(slice.openChannels, from, (ch) => ({
          ...ch,
          name: to,
          messages: ch.messages.map((message) => (isSameName(message.target, from) ? { ...message, target: to } : message)),
        })),
      })));
    },
    setTopic: (channelName: string, newTopic: string) => {
      set((state) => updateActiveSlice(state, (slice) => ({
        openChannels: slice.openChannels.map((channel: ChannelExtended) => {
          if (!isSameName(channel.name, channelName)) {
            return channel;
          }

          return { ...channel, topic: newTopic };
        }),
      })));
    },
    setTopicSetBy: (channelName: string, nick: string, when: number) => {
      set((state) => updateActiveSlice(state, (slice) => ({
        openChannels: slice.openChannels.map((channel: ChannelExtended) => {
          if (!isSameName(channel.name, channelName)) {
            return channel;
          }

          return { ...channel, topicSetBy: nick, topicSetTime: when };
        }),
      })));
    },
    setAddMessage: (newMessage: Message, limit: number): void => {
      set((state) => updateActiveSlice(state, (slice) => ({
        openChannels: slice.openChannels.map((channel: ChannelExtended) => {
          if (!isSameName(channel.name, newMessage.target)) {
            return channel;
          }

          // chathistory can overlap with real-time messages
          if (channel.messages.some((m) => m.id === newMessage.id)) {
            return channel;
          }

          return { ...channel, messages: keepNewest([...channel.messages, newMessage], limit) };
        }),
      })));
    },
    setAddHistoryPage: (channelName: string, page: Message[], limit: number, beforeId?: string): void => {
      set((state) => updateActiveSlice(state, (slice) => ({
        openChannels: updateChannelByName(slice.openChannels, channelName, (channel) => ({
          ...channel,
          messages: keepNewest(mergeHistoryPage(channel.messages, page, beforeId), limit),
        })),
      })));
    },
    setUpdateMessage: (channelName: string, messageId: string, patch: Partial<Message>): void => {
      set((state) => updateActiveSlice(state, (slice) => ({
        openChannels: slice.openChannels.map((channel: ChannelExtended) => {
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
      })));
    },
    setTyping: (channelName: string, nick: string, status: UserTypingStatus) => {
      set((state) => updateActiveSlice(state, (slice) => ({
        openChannels: slice.openChannels.map((channel: ChannelExtended) => {
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
      })));
    },
    setClearAllTyping: () => {
      set((state) => updateActiveSlice(state, (slice) => ({
        openChannels: slice.openChannels.map((channel) =>
          channel.typing.length > 0 ? { ...channel, typing: [] } : channel,
        ),
      })));
    },
    setClearUnreadMessages: (channelName: string) => {
      set((state) => updateActiveSlice(state, (slice) => ({
        openChannelsShortList: updateChannelByName(slice.openChannelsShortList, channelName, (ch) => ({ ...ch, unReadMessages: 0, hasMention: false })),
        openChannels: updateChannelByName(slice.openChannels, channelName, (ch) => ({ ...ch, unReadMessages: 0, hasMention: false })),
      })));
    },
    setIncreaseUnreadMessages: (channelName: string) => {
      set((state) => updateActiveSlice(state, (slice) => ({
        openChannelsShortList: updateChannelByName(slice.openChannelsShortList, channelName, (ch) => ({ ...ch, unReadMessages: ch.unReadMessages + 1 })),
        openChannels: updateChannelByName(slice.openChannels, channelName, (ch) => ({ ...ch, unReadMessages: ch.unReadMessages + 1 })),
      })));
    },
    setUnreadMessages: (channelName: string, count: number, hasMention: boolean) => {
      set((state) => updateActiveSlice(state, (slice) => ({
        openChannelsShortList: updateChannelByName(slice.openChannelsShortList, channelName, (ch) => ({ ...ch, unReadMessages: count, hasMention })),
        openChannels: updateChannelByName(slice.openChannels, channelName, (ch) => ({ ...ch, unReadMessages: count, hasMention })),
      })));
    },
    setHasMention: (channelName: string) => {
      set((state) => updateActiveSlice(state, (slice) => ({
        openChannelsShortList: updateChannelByName(slice.openChannelsShortList, channelName, (ch) => ({ ...ch, hasMention: true })),
        openChannels: updateChannelByName(slice.openChannels, channelName, (ch) => ({ ...ch, hasMention: true })),
      })));
    },
    setChannelAvatar: (channelName: string, avatar: string) => {
      set((state) => updateActiveSlice(state, (slice) => ({
        openChannelsShortList: updateChannelByName(slice.openChannelsShortList, channelName, (ch) => ({ ...ch, avatar })),
        openChannels: updateChannelByName(slice.openChannels, channelName, (ch) => ({ ...ch, avatar })),
      })));
    },
    setChannelDisplayName: (channelName: string, displayName: string) => {
      set((state) => updateActiveSlice(state, (slice) => ({
        openChannelsShortList: updateChannelByName(slice.openChannelsShortList, channelName, (ch) => ({ ...ch, displayName })),
        openChannels: updateChannelByName(slice.openChannels, channelName, (ch) => ({ ...ch, displayName })),
      })));
    },
    setClearMessages: (channelName: string) => {
      set((state) => updateActiveSlice(state, (slice) => ({
        openChannels: slice.openChannels.map((channel) => {
          if (!isSameName(channel.name, channelName)) {
            return channel;
          }
          return { ...channel, messages: [] };
        }),
      })));
    },
    setClearAll: () => {
      set((state) => updateActiveSlice(state, () => ({
        openChannels: [],
        openChannelsShortList: [],
      })));
    },
  }),
  ),
);

/** The active network's windows */
export const useActiveChannels = <T>(selector: (slice: ChannelsSlice) => T): T => useActiveSlice(useChannelsStore, selector);

const getChannels = (): ChannelsSlice => activeSlice(useChannelsStore.getState());

/** The order of the window groups in the sidebar */
export const CHANNEL_CATEGORY_ORDER: ChannelCategory[] = [ChannelCategory.status, ChannelCategory.debug, ChannelCategory.channel, ChannelCategory.priv];

export const setAddChannel = (channelName: string, category: ChannelCategory): void => {
  if (!existChannel(channelName)) {
    useChannelsStore.getState().setAddChannel(channelName, category);
  }
};

export const setRemoveChannel = (channelName: string): void => {
  useChannelsStore.getState().setRemoveChannel(channelName);
};

export const getChannel = (channelName: string): ChannelExtended | undefined => {
  return getChannels().openChannels.find((channel: ChannelExtended) => isSameName(channel.name, channelName));
};

export const existChannel = (channelName: string): boolean => {
  return getChannel(channelName) !== undefined;
};

// For server-canonical casing and DM nick changes; the current-view check must match `from`, not `to`
export const setRenameChannel = (from: string, to: string): void => {
  if (from === to || !existChannel(from)) {
    return;
  }

  const currentChannelName = getCurrentChannelName();
  const wasCurrent = isSameName(currentChannelName, from);

  useChannelsStore.getState().setRenameChannel(from, to);

  if (wasCurrent) {
    setCurrentChannelName(to, getCategory(to) ?? ChannelCategory.channel);
  }
};

export const getOpenChannelNames = (): string[] => {
  return getChannels().openChannelsShortList
    .filter((ch) => ch.category === ChannelCategory.channel)
    .map((ch) => ch.name);
};

export const getChannelsToAutoJoin = (): string[] => {
  const channels = getOpenChannelNames();
  return channels.length > 0 ? channels : lastChannelsToAutoJoin;
};

export const getOpenDmNicks = (): string[] => {
  return getChannels().openChannelsShortList
    .filter((ch) => ch.category === ChannelCategory.priv)
    .map((ch) => ch.name);
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

// The window being read keeps more, so history scrolled back to is not trimmed away
const messageLimit = (isCurrent: boolean): number => (isCurrent ? maxViewedMessages : maxMessages);

const ensureChannel = (target: string): void => {
  if (existChannel(target)) {
    return;
  }

  let category;
  if (isSameName(target, DEBUG_CHANNEL)) {
    category = ChannelCategory.debug;
  } else if (isSameName(target, STATUS_CHANNEL)) {
    category = ChannelCategory.status;
  } else {
    category = isPriv(target) ? ChannelCategory.priv : ChannelCategory.channel;
  }

  useChannelsStore.getState().setAddChannel(target, category);
};

export const setAddMessage = (newMessage: Message): void => {
  ensureChannel(newMessage.target);

  const isCurrent = isSameName(getCurrentChannelName(), newMessage.target);
  useChannelsStore.getState().setAddMessage(newMessage, messageLimit(isCurrent));

  if (isCurrent) {
    useCurrentStore.getState().setUpdateMessages(getMessages(newMessage.target));
  }
};

/** A chathistory page, in the server's order: placed among what is shown rather than at the end; older than the message `beforeId` when given */
/** History is asked for an open window; one closed before its page came (a kick, a part) stays closed */
export const setAddHistoryPage = (page: Message[], beforeId?: string): void => {
  const currentChannelName = getCurrentChannelName();
  const targets = [...new Set(page.map((message) => message.target))].filter((target) => existChannel(target));

  for (const target of targets) {
    const isCurrent = isSameName(currentChannelName, target);
    useChannelsStore.getState().setAddHistoryPage(target, page.filter((message) => message.target === target), messageLimit(isCurrent), beforeId);

    if (isCurrent) {
      useCurrentStore.getState().setUpdateMessages(getMessages(target));
    }
  }
};

// Fills in an E2EE placeholder once decryption resolves, keeping arrival order
export const setUpdateMessage = (channelName: string, messageId: string, patch: Partial<Message>): void => {
  useChannelsStore.getState().setUpdateMessage(channelName, messageId, patch);

  if (isSameName(getCurrentChannelName(), channelName)) {
    useCurrentStore.getState().setUpdateMessages(getMessages(channelName));
  }
};

export const setAddMessageToAllChannels = (newMessage: Omit<Message, 'target'>): void => {
  const channels = getChannels().openChannels;
  const currentChannelName = getCurrentChannelName();

  for (const channel of channels) {
    const isCurrent = isSameName(currentChannelName, channel.name);
    useChannelsStore.getState().setAddMessage({ ...newMessage, target: channel.name }, messageLimit(isCurrent));

    if (isCurrent) {
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

// Per the typing spec, in case the sender's client dies before sending 'done'
const TYPING_EXPIRY_MS: Partial<Record<UserTypingStatus, number>> = {
  active: 6_000,
  paused: 30_000,
};

const typingExpiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Folded so a timer armed for #Religie is found again when the 'done' arrives for #religie
const typingExpiryKey = (channelName: string, nick: string): string => {
  const mapping = getCaseMapping();
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

export const setUnreadMessages = (channelName: string, count: number, hasMention: boolean): void => {
  useChannelsStore.getState().setUnreadMessages(channelName, count, hasMention);
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

export const isChannel = (channelName: string): boolean => {
  const char = channelName?.[0];
  if (char === undefined) {
    return false;
  }
  return getChannelTypes().includes(char);
};

export const isPriv = (channelName: string): boolean => Boolean(channelName) && !isChannel(channelName);

let lastChannelsToAutoJoin: string[] = [];

export const setChannelsClearAll = (): void => {
  lastChannelsToAutoJoin = getChannelsToAutoJoin();
  clearAllTypingExpiry();
  useChannelsStore.getState().setClearAll();
};

/** The channels kept for the next connection belong to another network */
export const forgetChannelsToAutoJoin = (): void => {
  lastChannelsToAutoJoin = [];
};

