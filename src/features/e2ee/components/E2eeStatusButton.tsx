import { useTranslation } from 'react-i18next';
import { Lock, LockOpen, ShieldAlert } from 'lucide-react';

import { Button } from '@shared/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/components/ui/tooltip';

import { acknowledgePlaintext, endSession, hasPinnedPeer, markVerified, offerEncryption } from '../session';
import { E2eeState, getSessionKey, useE2eeStore, type E2eeSession } from '../store/e2ee';
import { useE2eePinsStore } from '../store/pins';

interface E2eeStatusButtonProps {
  /** The peer nick — private windows are named after them. */
  channelName: string;
}

type StatusKind = 'fingerprintChanged' | 'verified' | 'unverified' | 'plaintextAgain' | 'off';

/**
 * Icon, color, and tooltip for each status, kept in one place rather than as
 * three parallel branches that all have to be edited in lockstep to add or
 * change a status — the same shape `E2eeBanner`'s `TONE_CLASSES` uses.
 */
const STATUS_DISPLAY: Record<StatusKind, { Icon: typeof Lock; iconClass: string; tooltipKey: string }> = {
  fingerprintChanged: { Icon: ShieldAlert, iconClass: 'text-red-600 dark:text-red-400', tooltipKey: 'e2ee.status.fingerprintChanged' },
  verified: { Icon: Lock, iconClass: 'text-green-600 dark:text-green-400', tooltipKey: 'e2ee.status.verified' },
  unverified: { Icon: Lock, iconClass: 'text-yellow-600 dark:text-yellow-400', tooltipKey: 'e2ee.status.unverified' },
  // An open padlock means something different for a peer we have encrypted
  // with before, so it does not get the same neutral grey as a stranger's.
  plaintextAgain: { Icon: LockOpen, iconClass: 'text-yellow-600 dark:text-yellow-400', tooltipKey: 'e2ee.status.plaintextAgain' },
  off: { Icon: LockOpen, iconClass: 'text-muted-foreground', tooltipKey: 'e2ee.status.off' },
};

/**
 * The lock in the conversation header: current state at a glance, and the
 * fingerprint pair behind a click.
 *
 * The fingerprints are the whole reason this popover exists. TOFU pinning
 * catches a key that changes later, but an attacker present at the very first
 * handshake is only caught by two people comparing these strings somewhere the
 * IRC network cannot reach — so the panel states plainly that an unverified
 * session is unverified, rather than showing a reassuring padlock and leaving it
 * there.
 */
const E2eeStatusButton = ({ channelName }: E2eeStatusButtonProps) => {
  const { t } = useTranslation();
  const session: E2eeSession | undefined = useE2eeStore((state) => state.sessions[getSessionKey(channelName)]);
  const pinned = useE2eePinsStore(() => hasPinnedPeer(channelName));

  const isActive = session?.state === E2eeState.active;
  const isAlarming = session?.state === E2eeState.fingerprintChanged;
  const isUnexpectedlyPlaintext = !isActive && !isAlarming && pinned;

  const statusKind: StatusKind = isAlarming
    ? 'fingerprintChanged'
    : isActive
      ? session.verified
        ? 'verified'
        : 'unverified'
      : isUnexpectedlyPlaintext
        ? 'plaintextAgain'
        : 'off';

  const { Icon, iconClass, tooltipKey } = STATUS_DISPLAY[statusKind];
  const tooltip = t(tooltipKey);

  return (
    <Popover>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="h-12 ml-2 shrink-0"
                data-testid="e2ee-status-button"
                aria-label={tooltip}
              >
                <Icon className={`h-4 w-4 ${iconClass}`} />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent className="w-80 text-sm" align="end">
        <div className="font-semibold mb-2">{t('e2ee.panel.title', { nick: channelName })}</div>

        {isActive ? (
          <>
            <dl className="space-y-2 mb-3">
              <div>
                <dt className="text-xs text-muted-foreground">{t('e2ee.panel.yourFingerprint')}</dt>
                <dd className="font-mono text-xs break-all" data-testid="e2ee-my-fingerprint">
                  {session.myFingerprint}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('e2ee.panel.theirFingerprint', { nick: channelName })}</dt>
                <dd className="font-mono text-xs break-all" data-testid="e2ee-their-fingerprint">
                  {session.theirFingerprint}
                </dd>
              </div>
            </dl>

            <p className="text-xs text-muted-foreground mb-3">
              {session.verified ? t('e2ee.panel.verifiedHint') : t('e2ee.panel.unverifiedHint')}
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                data-testid="e2ee-verify-button"
                onClick={() => { markVerified(channelName, !session.verified); }}
              >
                {session.verified ? t('e2ee.action.unverify') : t('e2ee.action.verify')}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                data-testid="e2ee-end-button"
                onClick={() => {
                  endSession(channelName);
                  // Chosen, not lost — warning about it would be nagging.
                  acknowledgePlaintext(channelName);
                }}
              >
                {t('e2ee.action.end')}
              </Button>
            </div>
          </>
        ) : isAlarming ? (
          <>
            <p className="text-xs mb-3">{t('e2ee.panel.fingerprintChangedHint', { nick: channelName })}</p>
            <dl className="space-y-2 mb-3">
              <div>
                <dt className="text-xs text-muted-foreground">{t('e2ee.panel.expectedFingerprint')}</dt>
                <dd className="font-mono text-xs break-all">{session.expectedFingerprint}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">{t('e2ee.panel.receivedFingerprint')}</dt>
                <dd className="font-mono text-xs break-all">{session.theirFingerprint}</dd>
              </div>
            </dl>
            <Button variant="outline" className="w-full" onClick={() => { endSession(channelName, false); }}>
              {t('e2ee.action.dismiss')}
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-3">
              {isUnexpectedlyPlaintext ? t('e2ee.panel.plaintextAgainHint', { nick: channelName }) : t('e2ee.panel.offHint')}
            </p>
            <Button
              variant="outline"
              className="w-full"
              data-testid="e2ee-start-button"
              onClick={() => void offerEncryption(channelName)}
            >
              {t('e2ee.action.start')}
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default E2eeStatusButton;
