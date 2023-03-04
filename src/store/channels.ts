import { create } from 'zustand';
import { type Channel, type ChannelCategory, type Message } from '../types';
import { devtools, persist } from 'zustand/middleware';
import { maxMessages } from '../config/config';

export interface ChannelsStore {
  openChannels: Channel[];
  openChannelsShortList: string[];

  setAddChannel: (channelName: string, category: ChannelCategory) => void;
  setRemoveChannel: (channelName: string) => void;
  getChannel: (channelName: string) => Channel | undefined;
  setTopic: (channelName: string, newTopic: string) => void;
  getTopic: (channelName: string) => string;
  setTopicSetBy: (channelName: string, nick: string, when: number) => void;
  getTopicSetBy: (channelName: string) => string;
  getTopicTime: (channelName: string) => number;
  setAddMessage: (channelName: string, newMessage: Message) => void;
  getMessages: (channelName: string) => Message[];
  getCategory: (channelName: string) => ChannelCategory | undefined;
}

export const useChannelsStore = create<ChannelsStore>()(
  devtools(
    persist(
      (set, get) => ({
        openChannels: [],
        openChannelsShortList: [],

        setAddChannel: (channelName: string, category: ChannelCategory): void => {
          set((state) => ({
            openChannelsShortList: [...state.openChannelsShortList, channelName],
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
              },
            ],
          }));
        },
        setRemoveChannel: (channelName: string) => {
          set((state) => ({
            openChannelsShortList: state.openChannelsShortList.filter((channel) => channel !== channelName),
            openChannels: state.openChannels.filter((channel) => channel.name !== channelName),
          }));
        },
        getChannel: (channelName: string): Channel | undefined => {
          return get().openChannels.find((channel: Channel) => channel.name === channelName);
        },
        getOpenChannels: (): string[] => {
          return get().openChannels.map((channel) => channel.name);
        },
        setTopic: (channelName: string, newTopic: string) => {
          set((state) => ({
            openChannels: state.openChannels.map((channel: Channel) => {
              if (channel.name !== channelName) {
                return channel;
              }

              channel.topic = newTopic;
              return channel;
            }),
          }));
        },
        getTopic: (channelName: string): string => {
          return get().openChannels.find((channel: Channel) => channel.name === channelName)?.topic ?? '';
        },
        setTopicSetBy: (channelName: string, nick: string, when: number) => {
          set((state) => ({
            openChannels: state.openChannels.map((channel: Channel) => {
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
            openChannels: state.openChannels.map((channel: Channel) => {
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
      }),
      { name: 'channels' }
    )
  )
);
