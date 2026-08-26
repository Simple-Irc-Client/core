import { useTranslation } from 'react-i18next';
import { Lock, ShieldAlert, ShieldQuestion } from 'lucide-react';

import { ChannelCategory } from '@shared/types';
import { useSettingsStore } from '@features/settings/store/settings';

import { acceptIncomingOffer, acknowledgePlaintext, declineIncomingOffer, endSession, hasPinnedPeer, offerEncryption } from '../session';
import { E2eeState, useE2eeStore, getSessionKey, type E2eeSession } from '../store/e2ee';
import { useE2eePinsStore } from '../store/pins';

/**
 * The prompt strip at the top of a private conversation.
 *
 * Mirrors `DisconnectedBanner` — sticky, `role="status"`, inline text actions —
 * so encryption state reads as one more thing the window can tell you rather
 * than a modal that interrupts.
 *
 * Nothing is shown for the steady states: an active *verified* session is
 * represented by the lock in the header, not by a banner that never goes away.
 *
 * Every dismissal here also records that the user accepts plaintext for this
 * conversation. Without that, closing one banner would immediately raise the
 * "you have encrypted with this person before" one, and the user would be
 * playing whack-a-mole with warnings about a decision they just made.
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
  const e2eeEnabled = useSettingsStore((state) => state.e2eeEnabled);

  const sessionKey = getSessionKey(currentChannelName);
  const session: E2eeSession | undefined = useE2eeStore((state) => state.sessions[sessionKey]);
  const plaintextAcknowledged = useE2eeStore((state) => state.plaintextAcknowledged[sessionKey] === true);
  // Subscribed rather than read once: a pin is written the moment a handshake
  // completes, and this banner has to stop showing when that happens.
  const pinned = useE2eePinsStore(() => hasPinnedPeer(currentChannelName));

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
            {
              label: t('e2ee.action.decline'),
              onClick: () => {
                declineIncomingOffer(peer);
                acknowledgePlaintext(peer);
              },
            },
          ],
        };

      case E2eeState.offered:
        return {
          tone: 'info',
          icon: Lock,
          text: t('e2ee.banner.offered', { nick: peer }),
          actions: [
            {
              label: t('e2ee.action.cancel'),
              onClick: () => {
                endSession(peer);
                acknowledgePlaintext(peer);
              },
            },
          ],
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
          actions: [
            {
              label: t('e2ee.action.dismiss'),
              onClick: () => {
                endSession(peer, false);
                acknowledgePlaintext(peer);
              },
            },
          ],
        };

      case E2eeState.error:
        return {
          tone: 'warning',
          icon: ShieldAlert,
          text: session.errorMessage ?? t('e2ee.error.handshakeFailed'),
          actions: [
            ...(e2eeEnabled ? [{ label: t('e2ee.action.retry'), onClick: () => void offerEncryption(peer) }] : []),
            {
              label: t('e2ee.action.dismiss'),
              onClick: () => {
                endSession(peer, false);
                acknowledgePlaintext(peer);
              },
            },
          ],
        };

      // `declined` shows nothing: the peer refused and the info line already
      // said so, so a standing banner would just nag.
      case E2eeState.declined:
        return null;

      default:
        // No session at all. Silence is right for someone we have never
        // encrypted with — but not for someone we have. Encryption here is
        // opt-in and best-effort, so anyone able to drop OFFER frames or inject
        // a RESET can put the conversation back in the clear; pinning that peer
        // earlier is what lets us notice. Deliberately not phrased as an
        // accusation: a peer who simply reinstalled looks identical from here.
        return pinned && !plaintextAcknowledged
          ? {
              tone: 'warning',
              icon: ShieldAlert,
              text: t('e2ee.banner.plaintextAgain', { nick: peer }),
              actions: [
                ...(e2eeEnabled ? [{ label: t('e2ee.action.encrypt'), onClick: () => void offerEncryption(peer) }] : []),
                { label: t('e2ee.action.dismiss'), onClick: () => { acknowledgePlaintext(peer); } },
              ],
            }
          : null;
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
      className={`sticky top-0 z-10 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 px-4 py-2.5 text-xs ${TONE_CLASSES[content.tone]}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{content.text}</span>
      {content.actions.map((action, index) => (
        <span key={action.label} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
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
