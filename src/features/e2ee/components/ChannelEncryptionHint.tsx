import { useTranslation } from 'react-i18next';
import { LockOpen } from 'lucide-react';

import { Button } from '@shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/components/ui/tooltip';

/**
 * Header hint for regular channels: an open padlock explaining that,
 * unlike private conversations, channel messages are never end-to-end
 * encrypted — there is no peer to hold a key exchange with, so this is
 * informational only and has no popover or action attached.
 */
const ChannelEncryptionHint = () => {
  const { t } = useTranslation();
  const tooltip = t('e2ee.status.channelNotEncrypted');

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            className="h-12 ml-2 shrink-0 cursor-default hover:bg-transparent"
            data-testid="channel-encryption-hint"
            aria-label={tooltip}
          >
            <LockOpen className="h-4 w-4 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ChannelEncryptionHint;
