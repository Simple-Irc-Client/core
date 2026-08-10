import { useTranslation } from 'react-i18next';
import { Lock, ShieldAlert, ShieldQuestion } from 'lucide-react';

import { ChannelCategory } from '@shared/types';
import { useSettingsStore } from '@features/settings/store/settings';

import { acceptIncomingOffer, declineIncomingOffer, endSession, offerEncryption } from '../session';
import { E2eeState, useE2eeStore, getSessionKey, type E2eeSession } from '../store/e2ee';

/**
 * The prompt strip at the top of a private conversation.
 *
 * Mirrors `DisconnectedBanner` — sticky, `role="status"`, inline text actions —
 * so encryption state reads as one more thing the window can tell you rather
 * than a modal that interrupts.
 *
 * Nothing is shown for the steady states: an active *verified* session is
 * represented by the lock in the header, not by a banner that never goes away.
 */

interface BannerAction {
  label: string;
  onClick: () => void;
}

interface BannerContent {
  tone: 'info' | 'warning' | 'danger';
  icon: typeof Lock;
  text: string;
  actions: BannerAction[];
}

const TONE_CLASSES: Record<BannerContent['tone'], string> = {
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  warning: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-400',
  danger: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
};

const E2eeBanner = () => {
  const { t } = useTranslation();
  const currentChannelName = useSettingsStore((state) => state.currentChannelName);
  const currentChannelCategory = useSettingsStore((state) => state.currentChannelCategory);

  const session: E2eeSession | undefined = useE2eeStore((state) => state.sessions[getSessionKey(currentChannelName)]);

  // Encryption is one-to-one only, so this never appears on a channel window.
  if (currentChannelCategory !== ChannelCategory.priv) {
    return null;
  }

  const content = ((): BannerContent | null => {
    const peer = currentChannelName;

    switch (session?.state) {
      case E2eeState.incoming:
        return {
          tone: 'info',
          icon: ShieldQuestion,
          text: t('e2ee.banner.incoming', { nick: peer }),
          actions: [
            { label: t('e2ee.action.accept'), onClick: () => void acceptIncomingOffer(peer) },
            { label: t('e2ee.action.decline'), onClick: () => { declineIncomingOffer(peer); } },
          ],
        };

      case E2eeState.offered:
        return {
          tone: 'info',
          icon: Lock,
          text: t('e2ee.banner.offered', { nick: peer }),
          actions: [{ label: t('e2ee.action.cancel'), onClick: () => { endSession(peer); } }],
        };

      case E2eeState.active:
        // Once verified the header lock says everything; only nag while the
        // fingerprints are still unchecked.
        return session.verified
          ? null
          : {
              tone: 'warning',
              icon: Lock,
              text: t('e2ee.banner.unverified', { nick: peer }),
              actions: [],
            };

      case E2eeState.fingerprintChanged:
        return {
          tone: 'danger',
          icon: ShieldAlert,
          text: t('e2ee.banner.fingerprintChanged', { nick: peer }),
          actions: [{ label: t('e2ee.action.dismiss'), onClick: () => { endSession(peer, false); } }],
        };

      case E2eeState.error:
        return {
          tone: 'warning',
          icon: ShieldAlert,
          text: session.errorMessage ?? t('e2ee.error.handshakeFailed'),
          actions: [
            { label: t('e2ee.action.retry'), onClick: () => void offerEncryption(peer) },
            { label: t('e2ee.action.dismiss'), onClick: () => { endSession(peer, false); } },
          ],
        };

      // `declined` and `none` deliberately show nothing: the user said no, or
      // never asked, and a banner in either case is nagging.
      default:
        return null;
    }
  })();

  if (!content) {
    return null;
  }

  const Icon = content.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="e2ee-banner"
      className={`sticky top-0 z-10 flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs ${TONE_CLASSES[content.tone]}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{content.text}</span>
      {content.actions.map((action, index) => (
        <span key={action.label} className="flex items-center gap-1.5">
          {index > 0 && <span aria-hidden="true">|</span>}
          <button
            type="button"
            onClick={action.onClick}
            className="ml-1 underline hover:no-underline cursor-pointer"
          >
            {action.label}
          </button>
        </span>
      ))}
    </div>
  );
};

export default E2eeBanner;
