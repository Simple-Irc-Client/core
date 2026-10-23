import { Reply } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Out of the tab order, as the other message actions
const ReplyButton = ({ onClick }: { onClick: () => void }) => {
  const { t } = useTranslation();

  return (
    <button type="button" tabIndex={-1} className="sic-msg-action sic-msg-reply-action" aria-label={t('main.chat.reply')} title={t('main.chat.reply')} onClick={onClick}>
      <Reply className="h-4 w-4" />
    </button>
  );
};

export default ReplyButton;
