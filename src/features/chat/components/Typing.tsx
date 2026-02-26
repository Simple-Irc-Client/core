import { useTranslation } from 'react-i18next';
import { useCurrentStore } from '@features/chat/store/current';

const Typing = () => {
  const { t } = useTranslation();

  const typing = useCurrentStore((state) => state.typing);
  const filteredTyping = typing.filter(Boolean);

  return (
    <div className="text-xs h-7 ml-16 px-2 truncate text-gray-500" role="status" aria-live="polite">
      {filteredTyping.length !== 0 && (
        <>
          {filteredTyping.join(', ')}
          &nbsp;{t('main.user-typing')}
        </>
      )}
    </div>
  );
};

export default Typing;
