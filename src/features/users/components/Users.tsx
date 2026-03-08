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
import { Crown, ShieldCheck, Shield, ShieldHalf, Mic, Moon, X, WifiOff, Bot } from 'lucide-react';
import { cn, isSafeCssColor, ensureNickContrast } from '@shared/lib/utils';
import Avatar from '@shared/components/Avatar';
import { Button } from '@shared/components/ui/button';

const getModeIcons = (flags: string[], userModes: UserMode[]) => {
  if (flags.length === 0 || userModes.length === 0) { return null; }

  const icons: React.ReactNode[] = [];

  // Iterate through all modes in priority order and collect matching icons
  for (const mode of userModes) {
    if (flags.includes(mode.flag)) {
      switch (mode.symbol) {
        case '~':
          icons.push(<span key={mode.flag} title="Owner" aria-label="Owner"><Crown className="h-4 w-4 text-yellow-500" /></span>);
          break;
        case '&':
          icons.push(<span key={mode.flag} title="Admin" aria-label="Admin"><ShieldCheck className="h-4 w-4 text-purple-500" /></span>);
          break;
        case '@':
          icons.push(<span key={mode.flag} title="Operator" aria-label="Operator"><Shield className="h-4 w-4 text-green-500" /></span>);
          break;
        case '%':
          icons.push(<span key={mode.flag} title="Half-Op" aria-label="Half-Op"><ShieldHalf className="h-4 w-4 text-blue-500" /></span>);
          break;
        case '+':
          icons.push(<span key={mode.flag} title="Voice" aria-label="Voice"><Mic className="h-4 w-4 text-gray-500" /></span>);
          break;
        default:
          icons.push(<span key={mode.flag} className="text-xs font-bold" title={mode.flag} aria-label={mode.flag}>{mode.symbol}</span>);
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
  const { isUsersDrawerOpen, setUsersDrawerStatus } = useUsersDrawer();

  const currentChannelCategory: ChannelCategory = useSettingsStore((state) => state.currentChannelCategory);
  const currentChannelName = useSettingsStore((state) => state.currentChannelName);
  const userModes = useSettingsStore((state) => state.userModes);
  const hideAvatarsInUsersList = useSettingsStore((state) => state.hideAvatarsInUsersList);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const isDarkMode = useSettingsStore((s) => s.isDarkMode);
  const isConnected = useSettingsStore((state) => state.isConnected);
  const users = useCurrentStore((state) => state.users);
  const fontSizeClass = fontSizeClasses[fontSize];

  return (
    <>
      {(currentChannelCategory === ChannelCategory.channel || currentChannelCategory === ChannelCategory.priv || !isConnected) && (
        <aside
          aria-label={t('main.users.title')}
          className={cn(
            'border-l border-gray-200 dark:border-gray-700 overflow-y-auto bg-background',
            !isUsersDrawerOpen && 'hidden lg:block',
            isUsersDrawerOpen && 'absolute right-0 top-0 bottom-0 z-20 lg:relative lg:z-auto',
          )}
          style={{ width: `${width}px`, minWidth: `${defaultUsersWidth}px` }}
        >
          <div>
            <div className="flex items-center justify-between px-4 h-12 border-b border-gray-200 dark:border-gray-700">
              <h3 className={`${fontSizeClass} font-semibold uppercase tracking-wider`}>{t('main.users.title')} <span className="text-muted-foreground font-normal">({users.length})</span></h3>
              {isUsersDrawerOpen && (
                <Button variant="ghost" onClick={setUsersDrawerStatus} className="h-8 w-8 p-0 lg:hidden" aria-label={t('main.users.closeDrawer')}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {!isConnected && (
              <div role="status" aria-live="polite" className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-yellow-50 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400 text-xs">
                <WifiOff className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>{t('main.chat.notConnected')}</span>
              </div>
            )}
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
                      alt={user.displayName || user.nick}
                      fallbackLetter={(user.displayName || user.nick).substring(0, 1).toUpperCase()}
                      className="h-10 w-10"
                    />
                  )}
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      {(() => {
                        const channelFlags = user.channels.find((ch) => ch.name === currentChannelName)?.flags ?? [];
                        const isAway = user.away || channelFlags.includes('a');
                        return (
                          <>
                            {getModeIcons(channelFlags, userModes)}
                            {user.bot && (
                              <span title={t('main.users.bot')} aria-label={t('main.users.bot')}>
                                <Bot className="h-4 w-4 text-orange-400" />
                              </span>
                            )}
                            {isAway && (
                              <span title={user.awayReason || 'Away'} aria-label={user.awayReason || 'Away'}>
                                <Moon className="h-4 w-4 text-yellow-500" />
                              </span>
                            )}
                          </>
                        );
                      })()}
                      <span className={fontSizeClass} style={{ color: user.color && isSafeCssColor(user.color) ? ensureNickContrast(user.color, isDarkMode) : 'inherit' }}>
                        {user.displayName || user.nick}
                      </span>
                    </div>
                    {user.status && (
                      <span className="text-xs text-muted-foreground truncate max-w-37.5">
                        {user.status}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
      )}
    </>
  );
};

export default Users;
