import { useTranslation } from 'react-i18next';
import { useCurrentStore } from '@features/chat/store/current';
import { useSettingsStore } from '@features/settings/store/settings';

const Typing = () => {
  const { t } = useTranslation();

  const isConnected = useSettingsStore((state) => state.isConnected);
  const typing = useCurrentStore((state) => state.typing);
  const filteredTyping = typing.filter((nick) => nick.trim().length > 0);

  return (
    <div className="text-xs h-7 ml-16 px-2 truncate text-gray-500" role="status" aria-live="polite">
      {isConnected && filteredTyping.length !== 0 && t('main.user-typing', { nicks: filteredTyping.join(', ') })}
    </div>
  );
};

export default Typing;
