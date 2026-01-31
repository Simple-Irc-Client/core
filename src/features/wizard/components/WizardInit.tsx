import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui/button';
import { setWizardStep } from '@features/settings/store/settings';
import { isConnected as isWebSocketConnected, on, off } from '@/network/irc/network';

const WizardInit = () => {
  const { t } = useTranslation();
  // Don't show anything initially - only show error after explicit error event
  const [hasError, setHasError] = useState(false);
  // Show loading message after 3 seconds of waiting
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    // Check if already connected
    if (isWebSocketConnected()) {
      setWizardStep('nick');
      return undefined;
    }

    // Show loading message after 3 seconds
    const loadingTimeout = setTimeout(() => {
      setShowLoading(true);
    }, 3000);

    // Listen for WebSocket connection
    const handleConnect = () => {
      clearTimeout(loadingTimeout);
      setWizardStep('nick');
    };

    // Listen for WebSocket error to show error state
    const handleError = () => {
      clearTimeout(loadingTimeout);
      setHasError(true);
    };

    on('connect', handleConnect);
    on('error', handleError);

    return () => {
      clearTimeout(loadingTimeout);
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

  // Show error state only after connection fails
  if (hasError) {
    return (
      <div className="flex flex-col items-center">
        <h1 className="text-2xl font-semibold text-center">{t('wizard.init.title')}</h1>
        <p className="text-muted-foreground text-center mt-4">{t('wizard.init.message')}</p>
        <Button onClick={handleRetry} className="mt-8">
          {t('wizard.init.button.retry')}
        </Button>
      </div>
    );
  }

  // Show loading message after 3 seconds of waiting
  if (showLoading) {
    return (
      <div className="flex flex-col items-center">
        <p className="text-muted-foreground text-center">{t('wizard.init.loading')}</p>
      </div>
    );
  }

  // Default: show nothing while waiting for connection
  return null;
};

export default WizardInit;
