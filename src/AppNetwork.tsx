import React, { useEffect } from 'react';
import { useSettingsStore } from './store/settings';
import { useChannelListStore } from './store/channelsList';
import { useChannelsStore } from './store/channels';
import { useUsersStore } from './store/users';
import { ircSendList, sicSocket } from './network/network';
import { type IrcEvent, kernel } from './network/kernel';
import { DEBUG_CHANNEL } from './config';
import { MessageCategory } from './types';

export const AppNetwork = (): JSX.Element => {
  const settingsStore = useSettingsStore();
  const channelsStore = useChannelsStore();
  const channelListStore = useChannelListStore();
  const usersStore = useUsersStore();

  const onServerEvent = (data: IrcEvent): void => {
    // messages sent to server
    if (data?.line !== undefined) {
      channelsStore.setAddMessage(DEBUG_CHANNEL, {
        message: `-> ${data.line?.trim()}`,
        target: DEBUG_CHANNEL,
        time: new Date().toISOString(),
        category: MessageCategory.info,
      });
    }
  };

  useEffect(() => {
    // messages from server
    const onIrcEvent = (data: IrcEvent): void => {
      kernel(settingsStore, channelsStore, channelListStore, usersStore, data);
    };

    sicSocket.on('sic-irc-event', onIrcEvent);
    sicSocket.on('sic-server-event', onServerEvent);
    return () => {
      sicSocket.off('sic-irc-event', onIrcEvent);
      sicSocket.off('sic-server-event', onServerEvent);
    };
  }, [sicSocket, settingsStore, channelsStore, channelListStore, usersStore]);

  useEffect(() => {
    if (settingsStore.listRequestRemainingSeconds > -1) {
      const listRequestTimeout = setTimeout(() => {
        ircSendList();
      }, (settingsStore.listRequestRemainingSeconds + 1) * 1000);
      return () => {
        clearTimeout(listRequestTimeout);
      };
    }
  }, [settingsStore.listRequestRemainingSeconds]);

  return <></>;
};
