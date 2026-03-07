import { useTranslation } from 'react-i18next';
import { WifiOff } from 'lucide-react';
import { useSettingsStore, changeServer } from '@features/settings/store/settings';
import { ircReconnect } from '@/network/irc/network';

const DisconnectedBanner = () => {
  const { t } = useTranslation();
  const isConnecting = useSettingsStore((state) => state.isConnecting);
  return (
    <div role="status" aria-live="polite" className="sticky top-0 z-10 flex items-center justify-center gap-1.5 px-4 py-2.5 bg-yellow-50 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400 text-xs">
      <WifiOff className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{t('main.chat.notConnected')}</span>
      <button
        type="button"
        onClick={() => ircReconnect()}
        disabled={isConnecting}
        className="ml-1 underline hover:no-underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label={t('currentUser.connect')}
      >
        {isConnecting ? t('currentUser.connecting') : t('currentUser.connect')}
      </button>
      {!isConnecting && (
        <>
          <span aria-hidden="true">|</span>
          <button
            type="button"
            onClick={changeServer}
            className="underline hover:no-underline cursor-pointer"
            aria-label={t('currentUser.changeServer')}
          >
            {t('currentUser.changeServer')}
          </button>
        </>
      )}
    </div>
  );
};

export default DisconnectedBanner;
