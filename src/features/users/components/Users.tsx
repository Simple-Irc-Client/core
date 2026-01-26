import { useSettingsStore, type FontSize } from '@features/settings/store/settings';
import { ChannelCategory, type UserMode } from '@shared/types';

const fontSizeClasses: Record<FontSize, string> = {
  small: 'text-xs',
  medium: 'text-sm',
  large: 'text-base',
};
import { useTranslation } from 'react-i18next';
import { usersWidth as defaultUsersWidth } from '@/config/theme';
import { useCurrentStore } from '@features/chat/store/current';
import { useContextMenu } from '@/providers/ContextMenuContext';
import { useUsersDrawer } from '@/providers/DrawersContext';
import { Crown, ShieldCheck, Shield, ShieldHalf, Mic, Moon } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import Avatar from '@shared/components/Avatar';

const getModeIcons = (flags: string[], userModes: UserMode[]) => {
  if (flags.length === 0 || userModes.length === 0) return null;

  const icons: React.ReactNode[] = [];

  // Iterate through all modes in priority order and collect matching icons
  for (const mode of userModes) {
    if (flags.includes(mode.flag)) {
      switch (mode.symbol) {
        case '~':
          icons.push(<span key={mode.flag} title="Owner"><Crown className="h-4 w-4 text-yellow-500" /></span>);
          break;
        case '&':
          icons.push(<span key={mode.flag} title="Admin"><ShieldCheck className="h-4 w-4 text-purple-500" /></span>);
          break;
        case '@':
          icons.push(<span key={mode.flag} title="Operator"><Shield className="h-4 w-4 text-green-500" /></span>);
          break;
        case '%':
          icons.push(<span key={mode.flag} title="Half-Op"><ShieldHalf className="h-4 w-4 text-blue-500" /></span>);
          break;
        case '+':
          icons.push(<span key={mode.flag} title="Voice"><Mic className="h-4 w-4 text-gray-500" /></span>);
          break;
        default:
          icons.push(<span key={mode.flag} className="text-xs font-bold" title={mode.flag}>{mode.symbol}</span>);
          break;
      }
    }
  }

  return icons.length > 0 ? icons : null;
};

interface UsersProps {
  width?: number;
}

const Users = ({ width = defaultUsersWidth }: UsersProps) => {
  const { t } = useTranslation();

  const { handleContextMenuUserClick } = useContextMenu();
  const { isUsersDrawerOpen } = useUsersDrawer();

  const currentChannelCategory: ChannelCategory = useSettingsStore((state) => state.currentChannelCategory);
  const currentChannelName = useSettingsStore((state) => state.currentChannelName);
  const userModes = useSettingsStore((state) => state.userModes);
  const hideAvatarsInUsersList = useSettingsStore((state) => state.hideAvatarsInUsersList);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const users = useCurrentStore((state) => state.users);
  const fontSizeClass = fontSizeClasses[fontSize];

  return (
    <>
      {(currentChannelCategory === ChannelCategory.channel || currentChannelCategory === ChannelCategory.priv) && (
        <div
          className={cn(
            'border-l border-gray-200 dark:border-gray-700 overflow-y-auto',
            !isUsersDrawerOpen && 'hidden lg:block',
          )}
          style={{ width: `${width}px`, minWidth: `${defaultUsersWidth}px` }}
        >
          <div>
            <div className="mb-4">
              <h3 className={`${fontSizeClass} font-medium p-4`}>{t('main.users.title')}</h3>
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
                    <Avatar
                      src={user.avatar}
                      alt={user.nick}
                      fallbackLetter={user.nick.substring(0, 1).toUpperCase()}
                      className="h-10 w-10"
                    />
                  )}
                  <div className="flex items-center gap-1">
                    {(() => {
                      const channelFlags = user.channels.find((ch) => ch.name === currentChannelName)?.flags ?? [];
                      const isAway = user.away || channelFlags.includes('a');
                      return (
                        <>
                          {getModeIcons(channelFlags, userModes)}
                          {isAway && (
                            <span title={user.awayReason || 'Away'}>
                              <Moon className="h-4 w-4 text-yellow-500" />
                            </span>
                          )}
                        </>
                      );
                    })()}
                    <span className={fontSizeClass} style={{ color: user.color ?? 'inherit' }}>
                      {user.nick}
                    </span>
                  </div>
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
