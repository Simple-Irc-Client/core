import * as Sentry from '@sentry/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui/button';

export type LoadFailedLayout = 'page' | 'inline';

const layoutClasses: Record<LoadFailedLayout, string> = {
  page: 'flex h-screen flex-col items-center justify-center gap-4 p-8 text-center',
  inline: 'flex max-w-xs flex-col items-center gap-3 p-4 text-center text-sm',
};

const LoadFailedMessage = ({ layout }: { layout: LoadFailedLayout }) => {
  const { t } = useTranslation();

  return (
    <div role="alert" className={layoutClasses[layout]}>
      <p>{t('loadFailed.message')}</p>
      <Button type="button" size={layout === 'page' ? 'default' : 'sm'} onClick={() => globalThis.location.reload()}>
        {t('loadFailed.reload')}
      </Button>
    </div>
  );
};

/**
 * A lazily loaded part whose chunk fails to download (or that throws while rendering) shows a way out instead of
 * unmounting the whole app. A reload is the only retry: React.lazy keeps the rejected import for good.
 */
export const LoadFailedBoundary = ({ layout, children }: { layout: LoadFailedLayout; children: ReactNode }) => (
  <Sentry.ErrorBoundary fallback={<LoadFailedMessage layout={layout} />}>{children}</Sentry.ErrorBoundary>
);
