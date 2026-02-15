import { useEffect } from 'react';
import { useSettingsStore } from '@features/settings/store/settings';
import { setAddMessage } from '@features/channels/store/channels';
import { ircSendList, on, off, isConnected } from '@/network/irc/network';
import { type IrcEvent, Kernel } from '@/network/irc/kernel';
import { DEBUG_CHANNEL } from '@/config/config';
import { MessageCategory } from '@shared/types';
import { MessageColor } from '@/config/theme';
import { v4 as uuidv4 } from 'uuid';
import * as Sentry from '@sentry/react';
import { redactSensitiveIrc } from '@shared/lib/utils';

export const Network = () => {
  const listRequestRemainingSeconds = useSettingsStore((state) => state.listRequestRemainingSeconds);

  useEffect(() => {
    const onServerEvent = (data: IrcEvent): void => {
      // messages sent to server
      if (import.meta.env.DEV && data?.line !== undefined) {
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
        Sentry.captureException(err, {
          extra: {
            eventType: data?.type,
            eventLine: data?.line ? redactSensitiveIrc(data.line) : undefined,
          },
        });
        console.warn(err);
      }
    };

    on('sic-irc-event', onIrcEvent);
    on('sic-server-event', onServerEvent);

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
