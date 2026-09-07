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

    // Reconnect as soon as the network looks reachable again (tab foregrounded
    // on mobile, or the browser's `online` event) rather than waiting out the
    // time-based inactivity watchdog, whose timers are frozen while the tab is
    // backgrounded and which gives up entirely after a few failed retries.
    startReachabilityWatch();

    return () => {
      off('sic-irc-event', onIrcEvent);
      stopReachabilityWatch();
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
