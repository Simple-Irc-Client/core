import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/components/ui/tooltip';
import { getCurrentUserChannelModes } from '@features/users/store/users';
import ChannelSettings from './ChannelSettings';

const SETTINGS_ACCESS_FLAGS = ['h', 'o', 'a', 'q'];

interface ChannelSettingsButtonProps {
  channelName: string;
}

const ChannelSettingsButton = ({ channelName }: ChannelSettingsButtonProps) => {
  const { t } = useTranslation();
  const [dialogOpen, setDialogOpen] = useState(false);

  const userFlags = getCurrentUserChannelModes(channelName);
  const canAccessSettings = userFlags.some((flag) => SETTINGS_ACCESS_FLAGS.includes(flag));

  if (!canAccessSettings) {
    return null;
  }

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(true)}
              className="h-12 ml-2"
              data-testid="channel-settings-button"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('channelSettings.button.tooltip')}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <ChannelSettings
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        channelName={channelName}
      />
    </>
  );
};

export default ChannelSettingsButton;
