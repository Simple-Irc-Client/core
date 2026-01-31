import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui/button';
import { Progress } from '@shared/components/ui/progress';
import { setWizardStep } from '@features/settings/store/settings';
import { isConnected as isWebSocketConnected, isWebSocketConnecting, on, off } from '@/network/irc/network';

const WizardInit = () => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(() => isWebSocketConnecting());

  useEffect(() => {
    // Check if already connected
    if (isWebSocketConnected()) {
      setWizardStep('nick');
      return undefined;
    }

    // Listen for WebSocket connection
    const handleConnect = () => {
      setWizardStep('nick');
    };

    // Listen for WebSocket error to stop loading
    const handleError = () => {
      setIsLoading(false);
    };

    on('connect', handleConnect);
    on('error', handleError);

    return () => {
      off('connect', handleConnect);
      off('error', handleError);
    };
  }, []);

  const handleRetry = () => {
    // Reload the page to retry connection
    window.location.reload();
  };

  // If WebSocket is connected, don't render anything (will redirect)
  if (isWebSocketConnected()) {
    return null;
  }

  // Show loading state while connecting
  if (isLoading) {
    return (
      <div className="flex flex-col items-center">
        <Progress value={30} className="w-64" />
        <p className="text-muted-foreground text-center mt-4">{t('wizard.init.loading')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <h1 className="text-2xl font-semibold text-center">{t('wizard.init.title')}</h1>
      <p className="text-muted-foreground text-center mt-4">{t('wizard.init.message')}</p>
      <Button onClick={handleRetry} className="mt-8">
        {t('wizard.init.button.retry')}
      </Button>
    </div>
  );
};

export default WizardInit;
