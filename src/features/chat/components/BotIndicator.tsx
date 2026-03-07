import { useTranslation } from 'react-i18next';
import { Bot } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/components/ui/tooltip';

const BotIndicator = () => {
  const { t } = useTranslation();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Bot className="h-4 w-4 inline-block ml-1 relative top-0.75 text-orange-400" aria-label={t('main.users.bot')} />
        </TooltipTrigger>
        <TooltipContent>{t('main.users.bot')}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default BotIndicator;
