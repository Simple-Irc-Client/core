import { create } from 'zustand';
import { type UserTypingStatus, type Channel, type ChannelCategory, type Message, type ChannelExtended } from '../types';
import { devtools, persist } from 'zustand/middleware';
import { maxMessages } from '../config/config';

export interface ChannelsStore {
  openChannels: ChannelExtended[];
  openChannelsShortList: Channel[];

  setAddChannel: (channelName: string, category: ChannelCategory) => void;
  setRemoveChannel: (channelName: string) => void;
  getChannel: (channelName: string) => ChannelExtended | undefined;
  setTopic: (channelName: string, newTopic: string) => void;
  getTopic: (channelName: string) => string;
  setTopicSetBy: (channelName: string, nick: string, when: number) => void;
  getTopicSetBy: (channelName: string) => string;
  getTopicTime: (channelName: string) => number;
  setAddMessage: (channelName: string, newMessage: Message) => void;
  getMessages: (channelName: string) => Message[];
  getCategory: (channelName: string) => ChannelCategory | undefined;
  setTyping: (channelName: string, nick: string, status: UserTypingStatus) => void;
  getTyping: (channelName: string) => string[];
  setClearUnreadMessages: (channelName: string) => void;
  setIncreaseUnreadMessages: (channelName: string) => void;
}

export const useChannelsStore = create<ChannelsStore>()(
  devtools(
    persist(
      (set, get) => ({
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
        getChannel: (channelName: string): ChannelExtended | undefined => {
          return get().openChannels.find((channel: ChannelExtended) => channel.name === channelName);
        },
        getOpenChannels: (): string[] => {
          return get().openChannels.map((channel) => channel.name);
        },
        setTopic: (channelName: string, newTopic: string) => {
          set((state) => ({
            openChannels: state.openChannels.map((channel: ChannelExtended) => {
              if (channel.name !== channelName) {
                return channel;
              }

              channel.topic = newTopic;
              return channel;
            }),
          }));
        },
        getTopic: (channelName: string): string => {
          return get().openChannels.find((channel: ChannelExtended) => channel.name === channelName)?.topic ?? '';
        },
        setTopicSetBy: (channelName: string, nick: string, when: number) => {
          set((state) => ({
            openChannels: state.openChannels.map((channel: ChannelExtended) => {
              if (channel.name !== channelName) {
                return channel;
              }

              channel.topicSetBy = nick;
              channel.topicSetTime = when;
              return channel;
            }),
          }));
        },
        getTopicSetBy: (channelName: string): string => {
          return get().getChannel(channelName)?.topicSetBy ?? '';
        },
        getTopicTime: (channelName: string): number => {
          return get().getChannel(channelName)?.topicSetTime ?? 0;
        },
        setAddMessage: (channelName: string, newMessage: Message): void => {
          set((state) => ({
            openChannels: state.openChannels.map((channel: ChannelExtended) => {
              if (channel.name !== channelName) {
                return channel;
              }

              channel.messages.push(newMessage);
              if (channel.messages.length > maxMessages) {
                channel.messages.shift();
              }
              return channel;
            }),
          }));
        },
        getMessages: (channelName: string): Message[] => {
          return get().getChannel(channelName)?.messages ?? [];
        },
        getCategory: (channelName: string): ChannelCategory | undefined => {
          return get().getChannel(channelName)?.category ?? undefined;
        },
        setTyping: (channelName: string, nick: string, status: UserTypingStatus) => {
          set((state) => ({
            openChannels: state.openChannels.map((channel: ChannelExtended) => {
              if (channel.name !== channelName) {
                return channel;
              }

              switch (status) {
                case 'done':
                  channel.typing = channel.typing.filter((typingNick) => typingNick !== nick);
                  break;
                case 'active':
                case 'paused':
                  if (!channel.typing.includes(nick)) {
                    channel.typing.push(nick);
                  }
                  break;
              }

              return channel;
            }),
          }));
        },
        getTyping: (channelName: string): string[] => {
          return get().getChannel(channelName)?.typing ?? [];
        },
        setClearUnreadMessages: (channelName: string) => {
          set((state) => ({
            openChannels: state.openChannels.map((channel: ChannelExtended) => {
              if (channel.name !== channelName) {
                return channel;
              }

              channel.unReadMessages = 0;
              return channel;
            }),
          }));
        },
        setIncreaseUnreadMessages: (channelName: string) => {
          set((state) => ({
            openChannelsShortList: state.openChannels.map((channel: Channel) => {
              if (channel.name !== channelName) {
                return channel;
              }

              channel.unReadMessages++;
              return channel;
            }),
            openChannels: state.openChannels.map((channel: ChannelExtended) => {
              if (channel.name !== channelName) {
                return channel;
              }

              channel.unReadMessages++;
              return channel;
            }),
          }));
        },
      }),
      { name: 'channels' }
    )
  )
);
