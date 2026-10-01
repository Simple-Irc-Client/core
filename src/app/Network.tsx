import { useEffect } from 'react';
import { useSettingsStore } from '@features/settings/store/settings';
import { ircSendList, on, off, isConnected, startReachabilityWatch, stopReachabilityWatch } from '@/network/irc/network';
import { type IrcEvent, Kernel } from '@/network/irc/kernel';
import * as Sentry from '@sentry/react';
import { redactSensitiveIrc } from '@shared/lib/utils';

export const Network = () => {
  const listRequestRemainingSeconds = useSettingsStore((state) => state.listRequestRemainingSeconds);

  useEffect(() => {
    const onIrcEvent = (data: IrcEvent): void => {
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

    startReachabilityWatch();

    return () => {
      off('sic-irc-event', onIrcEvent);
      stopReachabilityWatch();
    };
  }, []);

  // Servers refuse LIST in the first seconds after connecting
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
