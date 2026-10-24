import { Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Out of the tab order, as the other message actions
const RedactButton = ({ onClick }: { onClick: () => void }) => {
  const { t } = useTranslation();

  return (
    <button type="button" tabIndex={-1} className="sic-msg-action sic-msg-delete-action" aria-label={t('main.chat.delete')} title={t('main.chat.delete')} onClick={onClick}>
      <Trash2 className="h-4 w-4" />
    </button>
  );
};

export default RedactButton;
