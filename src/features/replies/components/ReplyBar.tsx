import { Reply, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getDisplayNickFromMessage } from '@shared/lib/displayName';
import { stripIrcFormatting } from '@shared/lib/ircFormatting';
import { type Message } from '@shared/types';

interface ReplyBarProps {
  message: Message;
  onCancel: () => void;
}

/** Above the input: the message the next one answers */
const ReplyBar = ({ message, onCancel }: ReplyBarProps) => {
  const { t } = useTranslation();

  return (
    <div className="sic-reply-bar flex items-center gap-2 pl-[68px] pr-4 text-xs text-muted-foreground">
      <Reply className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">
        {t('main.toolbar.replyingTo', { nick: getDisplayNickFromMessage(message) })} {stripIrcFormatting(message.message)}
      </span>
      <button type="button" className="ml-auto shrink-0 rounded p-1 hover:text-foreground" aria-label={t('main.toolbar.cancelReply')} onClick={onCancel}>
        <X className="h-3 w-3" />
      </button>
    </div>
  );
};

export default ReplyBar;
