import { useTranslation } from 'react-i18next';
import { useCurrentStore } from '@features/chat/store/current';
import { useActiveSession } from '@features/networks/store/networks';

const Typing = () => {
  const { t } = useTranslation();

  const isConnected = useActiveSession((session) => session.isConnected);
  const typing = useCurrentStore((state) => state.typing);
  const filteredTyping = typing.filter((nick) => nick.trim().length > 0);

  return (
    <div className="sic-typing text-xs h-7 pl-[68px] pr-4 truncate text-gray-500" role="status" aria-live="polite">
      {isConnected && filteredTyping.length !== 0 && t('main.user-typing', { nicks: filteredTyping.join(', ') })}
    </div>
  );
};

export default Typing;
