import { useTranslation } from 'react-i18next';
import { Lock, LockOpen } from 'lucide-react';

import { MessageColor } from '@/config/theme';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/components/ui/tooltip';
import type { Message } from '@shared/types';

interface E2eeIndicatorProps {
  state: NonNullable<Message['e2ee']>;
}

/**
 * The small lock next to an encrypted message, mirroring `EchoedIndicator`.
 *
 * A successfully encrypted/decrypted message gets a green lock (`--msg-e2ee`,
 * matching the message's own border/background — see the `[data-e2ee='ok']`
 * rule in the theme CSS). The DM/mention highlight moved to `--secondary` so
 * this can own green without the two signals looking like one. A failed
 * decryption gets an open lock in the error colour rather than no indicator at
 * all, so the user sees that something arrived and could not be read instead
 * of silently missing it. Still resolving (`decrypting`) stays neutral.
 */
const E2eeIndicator = ({ state }: E2eeIndicatorProps) => {
  const { t } = useTranslation();

  const failed = state === 'failed';
  const Icon = failed ? LockOpen : Lock;
  const label = failed ? t('e2ee.indicator.failed') : state === 'decrypting' ? t('e2ee.indicator.decrypting') : t('e2ee.indicator.encrypted');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Icon
            className="sic-msg-e2ee h-3 w-3 inline-block ml-1"
            style={{ color: failed ? MessageColor.error : state === 'ok' ? MessageColor.e2ee : MessageColor.time }}
            aria-label={label}
          />
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default E2eeIndicator;
