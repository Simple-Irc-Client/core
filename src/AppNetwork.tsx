import React, { useContext, useEffect } from 'react';
import { useSettingsStore } from './store/settings';
import { useChannelsStore } from './store/channels';
import { ircSendList, sicSocket } from './network/network';
import { type IrcEvent, kernel } from './network/kernel';
import { DEBUG_CHANNEL } from './config/config';
import { MessageCategory } from './types';
import { MessageColor } from './config/theme';
import { ChannelListContext } from './providers/ChannelListContext';

export const AppNetwork = (): JSX.Element => {
  const listRequestRemainingSeconds = useSettingsStore((state) => state.listRequestRemainingSeconds);
  const channelListContext = useContext(ChannelListContext);

  const onServerEvent = (data: IrcEvent): void => {
    // messages sent to server
    if (data?.line !== undefined) {
      useChannelsStore.getState().setAddMessage(DEBUG_CHANNEL, {
        message: `-> ${data.line?.trim()}`,
        target: DEBUG_CHANNEL,
        time: new Date().toISOString(),
        category: MessageCategory.info,
        color: MessageColor.serverTo,
      });
    }
  };

  const onIrcEvent = (data: IrcEvent): void => {
    // messages from server
    kernel(data, channelListContext);
  };

  useEffect(() => {
    sicSocket.on('sic-irc-event', onIrcEvent);
    sicSocket.on('sic-server-event', onServerEvent);
    return () => {
      sicSocket.off('sic-irc-event', onIrcEvent);
      sicSocket.off('sic-server-event', onServerEvent);
    };
  }, []);

  // send LIST request after 20 seconds
  useEffect(() => {
    if (sicSocket.connected && listRequestRemainingSeconds > -1) {
      const listRequestTimeout = setTimeout(() => {
        ircSendList();
      }, (listRequestRemainingSeconds + 1) * 1000);
      return () => {
        clearTimeout(listRequestTimeout);
      };
    }
  }, [listRequestRemainingSeconds]);

  return <></>;
};
