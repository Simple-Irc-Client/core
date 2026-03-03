import { useTranslation } from 'react-i18next';
import { CheckCheck } from 'lucide-react';
import { MessageColor } from '@/config/theme';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/components/ui/tooltip';

const EchoedIndicator = () => {
  const { t } = useTranslation();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <CheckCheck className="h-3 w-3 inline-block ml-1" style={{ color: MessageColor.time }} />
        </TooltipTrigger>
        <TooltipContent>{t('main.chat.messageReceived')}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default EchoedIndicator;
