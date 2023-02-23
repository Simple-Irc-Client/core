import React, { useEffect } from 'react';
import { useSettingsStore } from './store/settings';
import { useChannelListStore } from './store/channelsList';
import { useChannelsStore } from './store/channels';
import { useUsersStore } from './store/users';
import { ircSendList, sicSocket } from './network/network';
import { type IrcEvent, kernel } from './network/kernel';

export const AppNetwork = (): JSX.Element => {
  const settingsStore = useSettingsStore();
  const channelsStore = useChannelsStore();
  const channelListStore = useChannelListStore();
  const usersStore = useUsersStore();

  useEffect(() => {
    const onIrcEvent = (data: IrcEvent): void => {
      kernel(settingsStore, channelsStore, channelListStore, usersStore, data);
    };

    sicSocket.on('sic-irc-event', onIrcEvent);
    return () => {
      sicSocket.off('sic-irc-event', onIrcEvent);
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
