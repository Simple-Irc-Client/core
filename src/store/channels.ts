import { create } from "zustand";
import { Channel, ChannelCategory, User } from "../types";
import { devtools, persist } from "zustand/middleware";

export interface ChannelsStore {
  openChannels: Channel[];

  setAddChannel: Function;
  setRemoveChannel: Function;
  getChannel: Function;
  setTopic: Function;
  getTopic: Function;
  setTopicSetBy: Function;
  getTopicSetBy: Function;
  getTopicTime: Function;
}

export const useChannelsStore = create<ChannelsStore>()(
  devtools(
    persist(
      (set, get) => ({
        openChannels: [],

        setAddChannel: (channelName: string, category: ChannelCategory): void =>
          set((state) => ({
            openChannels: [
              ...state.openChannels,
              {
                category,
                messages: [],
                name: channelName,
                topic: "",
                topicSetBy: "",
                topicSetTime: 0,
                unReadMessages: "0",
              },
            ],
          })),
        setRemoveChannel: (channelName: string) =>
          set((state) => ({
            openChannels: state.openChannels.filter(
              (channel) => channel.name !== channelName
            ),
          })),
        getChannel: (channelName: string): Channel | undefined => {
          return get().openChannels.find(
            (channel: Channel) => channel.name === channelName
          );
        },
        setTopic: (channelName: string, newTopic: string) =>
          set((state) => ({
            openChannels: state.openChannels.map((channel: Channel) => {
              if (channel.name === channelName) {
                channel.topic = newTopic;
              }
              return channel;
            }),
          })),
        getTopic: (channelName: string): string => {
          return (
            get().openChannels.find(
              (channel: Channel) => channel.name === channelName
            )?.topic ?? ""
          );
        },
        setTopicSetBy: (channelName: string, nick: string, when: number) =>
          set((state) => ({
            openChannels: state.openChannels.map((channel: Channel) => {
              if (channel.name === channelName) {
                channel.topicSetBy = nick;
                channel.topicSetTime = when;
              }
              return channel;
            }),
          })),
        getTopicTime: (channelName: string): number => {
          return get().getChannel(channelName)?.topicSetTime ?? 0;
        },
        getTopicSetBy: (channelName: string): string => {
          return get().getChannel(channelName)?.topicSetBy ?? "";
        },
      }),
      { name: "channels" }
    )
  )
);
