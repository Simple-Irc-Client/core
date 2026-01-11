import { useEffect } from 'react';
import { useSettingsStore } from './store/settings';
import { setAddMessage } from './store/channels';
import { ircSendList, initWebSocket, on, off, isConnected } from './network/irc/network';
import { type IrcEvent, Kernel } from './network/irc/kernel';
import { DEBUG_CHANNEL } from './config/config';
import { MessageCategory } from './types';
import { MessageColor } from './config/theme';
import { v4 as uuidv4 } from 'uuid';

export const AppNetwork = () => {
  const listRequestRemainingSeconds = useSettingsStore((state) => state.listRequestRemainingSeconds);

  useEffect(() => {
    const onServerEvent = (data: IrcEvent): void => {
      // messages sent to server
      if (data?.line !== undefined) {
        setAddMessage({
          id: uuidv4(),
          message: `<< ${data.line?.trim()}`,
          target: DEBUG_CHANNEL,
          time: new Date().toISOString(),
          category: MessageCategory.info,
          color: MessageColor.serverTo,
        });
      }
    };

    const onIrcEvent = (data: IrcEvent): void => {
      // messages from server
      try {
        new Kernel(data).handle();
      } catch (err) {
        console.warn(err);
      }
    };

    on('sic-irc-event', onIrcEvent);
    on('sic-server-event', onServerEvent);

    // Initialize WebSocket connection
    try {
      initWebSocket();
    } catch (err) {
      // Connection already in progress, that's fine
      console.debug('WebSocket initialization:', err);
    }

    return () => {
      off('sic-irc-event', onIrcEvent);
      off('sic-server-event', onServerEvent);
    };
  }, []);

  // send LIST request after 20 seconds
  useEffect(() => {
    if (isConnected() && listRequestRemainingSeconds > -1) {
      const listRequestTimeout = setTimeout(
        () => {
          ircSendList();
        },
        (listRequestRemainingSeconds + 1) * 1000,
      );
      return () => {
        clearTimeout(listRequestTimeout);
      };
    }
    return undefined;
  }, [listRequestRemainingSeconds]);

  return <></>;
};
