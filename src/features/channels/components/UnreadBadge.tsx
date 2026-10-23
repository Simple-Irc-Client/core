import { useTranslation } from 'react-i18next';
import { Badge } from '@shared/components/ui/badge';
import { cn } from '@shared/lib/utils';
import { type Channel } from '@shared/types';

const UnreadBadge = ({ channel }: { channel: Channel }) => {
  const { t } = useTranslation();

  return (
    <Badge
      variant="default"
      className={cn(
        'h-5 min-w-5 flex items-center justify-center text-xs',
        channel.hasMention && 'bg-[var(--msg-highlight)] text-white hover:bg-[var(--msg-highlight)] border-transparent',
      )}
      aria-label={channel.hasMention ? t('main.channels.unreadMentions', { count: channel.unReadMessages }) : t('main.channels.unreadCount', { count: channel.unReadMessages })}
    >
      {channel.unReadMessages > 99 ? '99+' : channel.unReadMessages}
    </Badge>
  );
};

export default UnreadBadge;
