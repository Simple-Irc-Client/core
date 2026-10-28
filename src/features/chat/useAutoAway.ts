import { useEffect, useEffectEvent, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@features/settings/store/settings';
import { getCurrentUserFlags, getIsConnected, setIsAutoAway, useActiveSession } from '@features/networks/store/networks';
import { ircSendRawMessage } from '@/network/irc/network';

/** Marks the user away after the time they chose without sending anything, and back once they send again */
export const useAutoAway = (): { noteActivity: () => void } => {
  const { t } = useTranslation();
  const isAway = useActiveSession((session) => session.currentUserFlags.includes('away'));
  const isAutoAway: boolean = useActiveSession((session) => session.isAutoAway);
  const autoAwayMinutes = useSettingsStore((state) => state.autoAwayMinutes);
  const isConnected: boolean = useActiveSession((session) => session.isConnected);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInactivityTimer = (): void => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    if (autoAwayMinutes === 0 || (isAway && !isAutoAway)) {
      return;
    }

    inactivityTimerRef.current = setTimeout(() => {
      if (getIsConnected() && !getCurrentUserFlags().includes('away')) {
        const message = useSettingsStore.getState().autoAwayMessage.trim() || t('currentUser.autoAway', { minutes: autoAwayMinutes });
        ircSendRawMessage(`AWAY :${message}`);
        setIsAutoAway(true);
      }
    }, autoAwayMinutes * 60 * 1000);
  };

  const startInactivityTimer = useEffectEvent(resetInactivityTimer);

  // A changed setting counts from now
  useEffect(() => {
    startInactivityTimer();

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, [autoAwayMinutes]);

  /** The user sent something: back from auto away, and the idle time counts from now */
  const noteActivity = (): void => {
    if (isAutoAway && isConnected) {
      ircSendRawMessage('AWAY');
      setIsAutoAway(false);
    }

    resetInactivityTimer();
  };

  return { noteActivity };
};
