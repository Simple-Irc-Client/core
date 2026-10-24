import { useTranslation } from 'react-i18next';
import { UserX } from 'lucide-react';
import { isSameName, useSettingsStore } from '@features/settings/store/settings';
import { forgetWantedNick, reclaimWantedNick } from '../nickRegain';

/** While connected under another nick than the one chosen: waits for it, or the user frees it or settles */
const NickRegainBanner = () => {
  const { t } = useTranslation();
  const isConnected = useSettingsStore((state) => state.isConnected);
  const nick = useSettingsStore((state) => state.nick);
  const wantedNick = useSettingsStore((state) => state.wantedNick);

  if (!isConnected || wantedNick === undefined || isSameName(wantedNick, nick)) {
    return null;
  }

  return (
    <div role="status" aria-live="polite" data-testid="nick-regain-banner" className="flex flex-wrap items-center justify-center gap-1.5 px-4 py-2.5 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300 text-xs">
      <UserX className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{t('nickRegain.banner', { nick: wantedNick, current: nick })}</span>
      <button type="button" onClick={reclaimWantedNick} className="ml-1 underline whitespace-nowrap hover:no-underline cursor-pointer" title={t('nickRegain.reclaimHint')}>
        {t('nickRegain.reclaim')}
      </button>
      <span aria-hidden="true">|</span>
      <button type="button" onClick={forgetWantedNick} className="underline whitespace-nowrap hover:no-underline cursor-pointer">
        {t('nickRegain.keep', { nick })}
      </button>
    </div>
  );
};

export default NickRegainBanner;
