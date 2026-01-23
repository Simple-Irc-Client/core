import { useTranslation } from 'react-i18next';
import { useCurrentStore } from '@features/chat/store/current';

const Typing = () => {
  const { t } = useTranslation();

  const typing = useCurrentStore((state) => state.typing);

  return (
    <div className="text-xs h-7 ml-16 px-1.75 truncate">
      {typing.length !== 0 && (
        <>
          {typing.join(', ')}
          &nbsp;{t('main.user-typing')}
        </>
      )}
    </div>
  );
};

export default Typing;
