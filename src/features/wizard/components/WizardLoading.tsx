import { useEffect, useState } from 'react';
import { Progress } from '@shared/components/ui/progress';
import { Button } from '@shared/components/ui/button';
import { useTranslation } from 'react-i18next';
import { getIsPasswordRequired, setWizardStep, useSettingsStore, setWizardProgress, getWizardProgress, resetAndGoToStart } from '@features/settings/store/settings';
import { ircConnect, ircDisconnect } from '@/network/irc/network';

const CONNECTION_TIMEOUT_MS = 60_000;

const WizardLoading = () => {
  const { t } = useTranslation();

  const isConnecting = useSettingsStore((state) => state.isConnecting);
  const isConnected = useSettingsStore((state) => state.isConnected);
  const wizardProgress = useSettingsStore((state) => state.wizardProgress);
  const server = useSettingsStore((state) => state.server);
  const nick = useSettingsStore((state) => state.nick);

  const [isTimedOut, setIsTimedOut] = useState(false);

  useEffect(() => {
    if (!isConnecting) {
      setIsTimedOut(false);
      return undefined;
    }

    const timeout = setTimeout(() => {
      setIsTimedOut(true);
    }, CONNECTION_TIMEOUT_MS);

    return () => {
      clearTimeout(timeout);
    };
  }, [isConnecting]);

  useEffect(() => {
    if (isConnecting) {
      setWizardProgress(1, t('wizard.loading.connecting'));
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
          setWizardStep('channels');
        }
      }, 5_000); // 5 sec

      return () => {
        clearTimeout(timeout2);
        clearTimeout(timeout5);
      };
    }

    // Read current value via getter to avoid dependency
    if (!isConnecting && !isConnected && getWizardProgress().value !== 0) {
      setWizardProgress(0, t('wizard.loading.disconnected'));
    }
    return undefined;
  }, [isConnecting, isConnected, t]);

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
      <Progress value={wizardProgress.value * 30} />
      {wizardProgress.label !== '' && <h2 className="text-center mt-4">{wizardProgress.label}</h2>}
      {isTimedOut && (
        <p className="text-center mt-4 text-muted-foreground">{t('wizard.loading.timeout')}</p>
      )}
      {(wizardProgress.value === 0 || isTimedOut) && (
        <div className="flex gap-4 mt-8">
          <Button onClick={handleGoBack} variant="outline" className="flex-1">
            {t('wizard.loading.button.goBack')}
          </Button>
          {isTimedOut && (
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
