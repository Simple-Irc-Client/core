import { useSettingsStore } from '@features/settings/store/settings';
import { ChannelCategory } from '@shared/types';
import { useTranslation } from 'react-i18next';
import { usersWidth } from '@/config/theme';
import { useCurrentStore } from '@features/chat/store/current';
import { useContextMenu } from '@/providers/ContextMenuContext';

const Users = () => {
  const { t } = useTranslation();

  const { handleContextMenuUserClick } = useContextMenu();

  const currentChannelCategory: ChannelCategory = useSettingsStore((state) => state.currentChannelCategory);
  const hideAvatarsInUsersList = useSettingsStore((state) => state.hideAvatarsInUsersList);
  const users = useCurrentStore((state) => state.users);

  return (
    <>
      {(currentChannelCategory === ChannelCategory.channel || currentChannelCategory === ChannelCategory.priv) && (
        <div className="hidden sm:block border-l border-gray-200 dark:border-gray-700 overflow-y-auto" style={{ minWidth: `${usersWidth}px` }}>
          <div>
            <div className="mb-4">
              <h3 className="text-sm font-medium p-4">{t('main.users.title')}</h3>
            </div>
            <div className="space-y-1">
              {users.map((user) => (
                <button
                  key={user.nick}
                  onClick={(event) => {
                    handleContextMenuUserClick(event, 'user', user.nick);
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    handleContextMenuUserClick(event, 'user', user.nick);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-left"
                >
                  {!hideAvatarsInUsersList && (
                    <div className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full">
                      {user.avatar ? (
                        <img className="aspect-square h-full w-full" alt={user.nick} src={user.avatar} />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                          {user.nick.substring(0, 1).toUpperCase()}
                        </span>
                      )}
                    </div>
                  )}
                  <span className="text-sm" style={{ color: user.color ?? 'inherit' }}>
                    {user.nick}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Users;
