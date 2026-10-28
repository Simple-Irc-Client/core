import { useEffect } from 'react';
import { useActiveSession } from '@features/networks/store/networks';
import { ircSendList, on, off, isConnected, startReachabilityWatch, stopReachabilityWatch } from '@/network/irc/network';
import { type IrcEvent, Kernel } from '@/network/irc/kernel';
import { startPresenceWatch, stopPresenceWatch } from '@/network/irc/preAway';
import * as Sentry from '@sentry/react';
import { redactSensitiveIrc } from '@shared/lib/utils';

export const Network = () => {
  const listRequestRemainingSeconds = useActiveSession((session) => session.listRequestRemainingSeconds);

  useEffect(() => {
    const onIrcEvent = (data: IrcEvent): void => {
      try {
        new Kernel(data).handle();
      } catch (err) {
        Sentry.captureException(err, {
          extra: {
            eventType: data.type,
            eventLine: data.line ? redactSensitiveIrc(data.line) : undefined,
          },
        });
        console.warn(err);
      }
    };

    on('sic-irc-event', onIrcEvent);

    startReachabilityWatch();
    startPresenceWatch();

    return () => {
      off('sic-irc-event', onIrcEvent);
      stopReachabilityWatch();
      stopPresenceWatch();
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

  return null;
};
