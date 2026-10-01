import { useTranslation } from 'react-i18next';
import { Lock, ShieldAlert, ShieldQuestion } from 'lucide-react';

import { ChannelCategory } from '@shared/types';
import { useSettingsStore } from '@features/settings/store/settings';

import { acknowledgePlaintext, declineIncomingOffer, hasPinnedPeer, offerEncryption } from '../session';
import { acceptOfferAndAnnounce, endSessionAndAnnounce } from '../incoming';
import { E2eeState, useE2eeStore, getSessionKey, type E2eeSession } from '../store/e2ee';
import { useE2eePinsStore } from '../store/pins';

/**
 * Not sticky itself: Chat's shared sticky wrapper stacks it with DisconnectedBanner. Every dismissal also
 * acknowledges plaintext, or closing one banner would immediately raise the "encrypted before" one.
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
  const isConnected = useSettingsStore((state) => state.isConnected);
  const canOffer = e2eeEnabled && isConnected;

  const sessionKey = getSessionKey(currentChannelName);
  const session: E2eeSession | undefined = useE2eeStore((state) => state.sessions[sessionKey]);
  const plaintextAcknowledged = useE2eeStore((state) => state.plaintextAcknowledged[sessionKey] === true);
  // Subscribed: the pin appears the moment a handshake completes
  const pinned = useE2eePinsStore(() => hasPinnedPeer(currentChannelName));

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
            { label: t('e2ee.action.accept'), onClick: () => void acceptOfferAndAnnounce(peer) },
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
                endSessionAndAnnounce(peer);
                acknowledgePlaintext(peer);
              },
            },
          ],
        };

      case E2eeState.active:
        // Unverified is the TOFU default; the header lock handles verification
        return null;

      case E2eeState.fingerprintChanged:
        return {
          tone: 'danger',
          icon: ShieldAlert,
          text: t('e2ee.banner.fingerprintChanged', { nick: peer }),
          actions: [
            {
              label: t('e2ee.action.dismiss'),
              onClick: () => {
                endSessionAndAnnounce(peer, false);
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
            ...(canOffer ? [{ label: t('e2ee.action.retry'), onClick: () => void offerEncryption(peer) }] : []),
            {
              label: t('e2ee.action.dismiss'),
              onClick: () => {
                endSessionAndAnnounce(peer, false);
                acknowledgePlaintext(peer);
              },
            },
          ],
        };

      // The info line already said so
      case E2eeState.declined:
        return null;

      default:
        // Warn only for a previously pinned peer (a downgrade is possible); not an accusation, they may have reinstalled
        return pinned && !plaintextAcknowledged
          ? {
              // Messages really go out in the clear here
              tone: 'danger',
              icon: ShieldAlert,
              text: t('e2ee.banner.plaintextAgain', { nick: peer }),
              actions: [
                ...(canOffer ? [{ label: t('e2ee.action.encrypt'), onClick: () => void offerEncryption(peer) }] : []),
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
      className={`flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 px-4 py-2.5 text-xs ${TONE_CLASSES[content.tone]}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span>{content.text}</span>
      {content.actions.length > 0 && (
        <div className="w-full flex justify-center items-center gap-1.5">
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
      )}
    </div>
  );
};

export default E2eeBanner;
