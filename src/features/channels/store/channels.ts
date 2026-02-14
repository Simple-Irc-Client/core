import { create } from 'zustand';
import { type UserTypingStatus, type Channel, ChannelCategory, type Message, type ChannelExtended } from '@shared/types';
import { devtools } from 'zustand/middleware';
import { DEBUG_CHANNEL, maxMessages, STATUS_CHANNEL } from '@/config/config';
import { getChannelTypes, getCurrentChannelName } from '@features/settings/store/settings';
import { useCurrentStore } from '@features/chat/store/current';

const updateChannelInBothLists = <T extends { name: string }>(
  list: T[],
  channelName: string,
  updater: (channel: T) => T,
): T[] => list.map((channel) => (channel.name === channelName ? updater(channel) : channel));

interface ChannelsStore {
  openChannels: ChannelExtended[];
  openChannelsShortList: Channel[];

  setAddChannel: (channelName: string, category: ChannelCategory) => void;
  setRemoveChannel: (channelName: string) => void;
  setTopic: (channelName: string, newTopic: string) => void;
  setTopicSetBy: (channelName: string, nick: string, when: number) => void;
  setAddMessage: (newMessage: Message) => void;
  /** IRCv3 message-tags (typing) */
  setTyping: (channelName: string, nick: string, status: UserTypingStatus) => void;
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

export const useChannelsStore = create<ChannelsStore>()(
  devtools((set) => ({
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
        openChannelsShortList: state.openChannelsShortList.filter((channel) => channel.name !== channelName),
        openChannels: state.openChannels.filter((channel) => channel.name !== channelName),
      }));
    },
    setTopic: (channelName: string, newTopic: string) => {
      set((state) => ({
        openChannels: state.openChannels.map((channel: ChannelExtended) => {
          if (channel.name !== channelName) {
            return channel;
          }

          return { ...channel, topic: newTopic };
        }),
      }));
    },
    setTopicSetBy: (channelName: string, nick: string, when: number) => {
      set((state) => ({
        openChannels: state.openChannels.map((channel: ChannelExtended) => {
          if (channel.name !== channelName) {
            return channel;
          }

          return { ...channel, topicSetBy: nick, topicSetTime: when };
        }),
      }));
    },
    setAddMessage: (newMessage: Message): void => {
      set((state) => ({
        openChannels: state.openChannels.map((channel: ChannelExtended) => {
          if (channel.name !== newMessage.target) {
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
    setTyping: (channelName: string, nick: string, status: UserTypingStatus) => {
      set((state) => ({
        openChannels: state.openChannels.map((channel: ChannelExtended) => {
          if (channel.name !== channelName) {
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
          if (channel.name !== channelName) {
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
  })),
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
  return useChannelsStore.getState().openChannels.find((channel: ChannelExtended) => channel.name === channelName);
};

export const existChannel = (channelName: string): boolean => {
  return useChannelsStore.getState().openChannels.find((channel: ChannelExtended) => channel.name === channelName) !== undefined;
};

export const setTopic = (channelName: string, newTopic: string): void => {
  useChannelsStore.getState().setTopic(channelName, newTopic);

  const currentChannelName = getCurrentChannelName();

  if (currentChannelName === channelName) {
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
    if (newMessage.target === DEBUG_CHANNEL) {
      category = ChannelCategory.debug;
    } else if (newMessage.target === STATUS_CHANNEL) {
      category = ChannelCategory.status;
    } else {
      category = isPriv(newMessage.target) ? ChannelCategory.priv : ChannelCategory.channel;
    }

    useChannelsStore.getState().setAddChannel(newMessage.target, category);
  }

  useChannelsStore.getState().setAddMessage(newMessage);

  const currentChannelName = getCurrentChannelName();

  if (currentChannelName === newMessage.target) {
    useCurrentStore.getState().setUpdateMessages(getMessages(newMessage.target));
  }
};

export const setAddMessageToAllChannels = (newMessage: Omit<Message, 'target'>): void => {
  const channels = useChannelsStore.getState().openChannels;
  const currentChannelName = getCurrentChannelName();

  for (const channel of channels) {
    useChannelsStore.getState().setAddMessage({ ...newMessage, target: channel.name });

    if (currentChannelName === channel.name) {
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
  if (currentChannelName === channelName) {
    useCurrentStore.getState().setUpdateMessages([]);
  }
};

export const getCategory = (channelName: string): ChannelCategory | undefined => {
  return getChannel(channelName)?.category ?? undefined;
};

export const setTyping = (channelName: string, nick: string, status: UserTypingStatus): void => {
  useChannelsStore.getState().setTyping(channelName, nick, status);

  const currentChannelName = getCurrentChannelName();

  if (currentChannelName === channelName) {
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

export const setChannelsClearAll = (): void => {
  useChannelsStore.getState().setClearAll();
};
