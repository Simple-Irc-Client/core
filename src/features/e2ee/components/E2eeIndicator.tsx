import { useTranslation } from 'react-i18next';
import { Lock, LockOpen } from 'lucide-react';

import { MessageColor } from '@/config/theme';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/components/ui/tooltip';
import type { Message } from '@shared/types';

interface E2eeIndicatorProps {
  state: NonNullable<Message['e2ee']>;
}

/** A failed decryption still gets an (open, error-coloured) lock, so it isn't silently missed. */
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
