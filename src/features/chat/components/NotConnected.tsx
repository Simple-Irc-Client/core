import { useTranslation } from 'react-i18next';
import { WifiOff } from 'lucide-react';

const NotConnected = () => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground" role="status" aria-live="polite">
      <WifiOff className="h-12 w-12 mb-4 opacity-50" aria-hidden="true" />
      <p className="text-lg font-medium">{t('main.chat.notConnected')}</p>
      <p className="text-sm mt-1">{t('main.chat.notConnectedDescription')}</p>
    </div>
  );
};

export default NotConnected;
