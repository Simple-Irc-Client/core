import { useEffect, useState } from 'react';
import { Progress } from '@shared/components/ui/progress';
import { Button } from '@shared/components/ui/button';
import { useTranslation } from 'react-i18next';
import { getIsPasswordRequired, setWizardStep, setWizardCompleted, useSettingsStore, setWizardProgress, getWizardProgress, resetAndGoToStart } from '@features/settings/store/settings';
import { ircConnect, ircDisconnect, ircJoinChannels, on, off } from '@/network/irc/network';
import { getChannelParam } from '@shared/lib/queryParams';
import { getPendingSTSUpgrade } from '@/network/irc/sts';
import { type IrcEvent } from '@/network/irc/kernel';
import { redactSensitiveIrc } from '@shared/lib/utils';

const CONNECTION_TIMEOUT_MS = 60_000;

const WizardLoading = () => {
  const { t } = useTranslation();

  const isConnecting = useSettingsStore((state) => state.isConnecting);
  const isConnected = useSettingsStore((state) => state.isConnected);
  const wizardProgress = useSettingsStore((state) => state.wizardProgress);
  const server = useSettingsStore((state) => state.server);
  const nick = useSettingsStore((state) => state.nick);

  const [isTimedOut, setIsTimedOut] = useState(false);
  const [lastServerMessage, setLastServerMessage] = useState('');

  // Track latest raw IRC message from the server for debugging
  useEffect(() => {
    const handleIrcEvent = (data: IrcEvent): void => {
      if (data?.type === 'raw' && data.line) {
        // Redact sensitive info (passwords, SASL tokens) then extract trailing text
        const safe = redactSensitiveIrc(data.line);
        const colonIndex = safe.indexOf(' :');
        const display = colonIndex !== -1 ? safe.substring(colonIndex + 2) : safe;
        setLastServerMessage(display.length > 120 ? display.substring(0, 120) + '...' : display);
      }
    };

    on('sic-irc-event', handleIrcEvent);
    return () => {
      off('sic-irc-event', handleIrcEvent);
    };
  }, []);

  useEffect(() => {
    if (!isConnecting) {
      return undefined;
    }

    const resetTimeout = setTimeout(() => {
      setIsTimedOut(false);
    }, 0);

    const timeout = setTimeout(() => {
      setIsTimedOut(true);
    }, CONNECTION_TIMEOUT_MS);

    return () => {
      clearTimeout(resetTimeout);
      clearTimeout(timeout);
    };
  }, [isConnecting]);

  const showTimeoutUI = isTimedOut && isConnecting;

  useEffect(() => {
    if (isConnecting) {
      if (getPendingSTSUpgrade()) {
        setWizardProgress(4 / 3, t('wizard.loading.connectingSecure'));
      } else {
        setWizardProgress(1, t('wizard.loading.connecting'));
      }
      return undefined;
    }

    if (isConnected) {
      setWizardProgress(2, t('wizard.loading.connected'));

      const timeout2 = setTimeout(() => {
        setWizardProgress(3, t('wizard.loading.isPasswordRequired'));
      }, 2_000); // 2 sec

      const timeout5 = setTimeout(() => {
        const isPasswordRequired = getIsPasswordRequired();
        if (isPasswordRequired === false || isPasswordRequired === undefined) {
          const channels = getChannelParam();
          if (channels) {
            ircJoinChannels(channels);
            setWizardCompleted(true);
          } else {
            setWizardStep('channels');
          }
        }
      }, 5_000); // 5 sec

      return () => {
        clearTimeout(timeout2);
        clearTimeout(timeout5);
      };
    }

    // Read current value via getter to avoid dependency
    // Skip showing "Disconnected" if there's a pending STS upgrade (reconnecting with TLS)
    if (!isConnecting && !isConnected && getWizardProgress().value !== 0 && !getPendingSTSUpgrade()) {
      setWizardProgress(0, t('wizard.loading.disconnected'));
    }
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnecting, isConnected]);

  const handleGoBack = (): void => {
    resetAndGoToStart();
  };

  const handleReconnect = (): void => {
    if (server !== undefined) {
      setIsTimedOut(false);
      ircDisconnect();
      ircConnect(server, nick);
    }
  };

  return (
    <div className="w-full mt-8">
      <Progress value={wizardProgress.value * 30} aria-label={t('a11y.connectionProgress')} />
      <div aria-live="polite">
        {wizardProgress.label !== '' && <h2 className="text-center mt-4">{wizardProgress.label}</h2>}
        {lastServerMessage !== '' && (
          <p className="text-center mt-2 text-xs text-muted-foreground truncate max-w-md mx-auto">{lastServerMessage}</p>
        )}
      </div>
      {showTimeoutUI && (
        <p className="text-center mt-4 text-muted-foreground">{t('wizard.loading.timeout')}</p>
      )}
      {(wizardProgress.value === 0 || showTimeoutUI) && (
        <div className="flex gap-4 mt-8">
          <Button onClick={handleGoBack} variant="outline" className="flex-1">
            {t('wizard.loading.button.goBack')}
          </Button>
          {showTimeoutUI && (
            <Button onClick={handleReconnect} className="flex-1">
              {t('wizard.loading.button.reconnect')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default WizardLoading;
