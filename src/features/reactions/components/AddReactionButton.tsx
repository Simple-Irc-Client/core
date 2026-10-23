import { SmilePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AddReactionButtonProps {
  onClick: (anchor: HTMLElement) => void;
}

// Out of the tab order: one stop per message would stand between the topic and the input
const AddReactionButton = ({ onClick }: AddReactionButtonProps) => {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      tabIndex={-1}
      className="sic-msg-react"
      aria-label={t('main.chat.addReaction')}
      title={t('main.chat.addReaction')}
      onClick={(event) => onClick(event.currentTarget)}
    >
      <SmilePlus className="h-4 w-4" />
    </button>
  );
};

export default AddReactionButton;
