import { useEffect } from 'react';
import { useSettingsStore } from '@features/settings/store/settings';
import { ircSendList, on, off, isConnected } from '@/network/irc/network';
import { type IrcEvent, Kernel } from '@/network/irc/kernel';
import * as Sentry from '@sentry/react';
import { redactSensitiveIrc } from '@shared/lib/utils';

export const Network = () => {
  const listRequestRemainingSeconds = useSettingsStore((state) => state.listRequestRemainingSeconds);

  useEffect(() => {
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

    return () => {
      off('sic-irc-event', onIrcEvent);
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
