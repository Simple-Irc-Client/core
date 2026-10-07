import { useTranslation } from 'react-i18next';
import { User as UserIcon, MessageSquare, Moon, Sun, LogIn, LogOut, ArrowLeftRight } from 'lucide-react';
import { useSettingsStore, resetAndGoToStart, changeServer, toggleDarkMode } from '@features/settings/store/settings';
import { ircReconnect } from '@/network/irc/network';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@shared/components/ui/dropdown-menu';
import { useAwayMessagesStore } from '@features/channels/store/awayMessages';

interface UserMenuProps {
  onOpenProfile: () => void;
  onOpenAwayMessages: () => void;
}

const UserMenu = ({ onOpenProfile, onOpenAwayMessages }: UserMenuProps) => {
  const { t } = useTranslation();

  const nick = useSettingsStore((state) => state.nick);
  const currentUserAvatar = useSettingsStore((state) => state.currentUserAvatar);
  const isAway = useSettingsStore((state) => state.currentUserFlags.includes('away'));
  const isConnected = useSettingsStore((state) => state.isConnected);
  const isConnecting = useSettingsStore((state) => state.isConnecting);
  const isDarkMode = useSettingsStore((state) => state.isDarkMode);
  const awayMessagesCount = useAwayMessagesStore((state) => state.messages.length);

  return (
    <div className="relative mr-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            data-avatar-button
            aria-label={t('main.toolbar.userMenu')}
            className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full hover:ring-2 hover:ring-ring/50 focus:outline-hidden focus:ring-2 focus:ring-ring"
          >
            {currentUserAvatar ? (
              <img
                src={currentUserAvatar}
                alt={nick}
                className="h-full w-full object-cover rounded-full"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center rounded-full bg-muted">
                {nick.substring(0, 1).toUpperCase()}
              </span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={onOpenProfile}>
            <UserIcon className="mr-2 h-4 w-4" />
            {t('profileSettings.title')}
          </DropdownMenuItem>
          {awayMessagesCount > 0 && (
            <DropdownMenuItem onClick={onOpenAwayMessages}>
              <MessageSquare className="mr-2 h-4 w-4" />
              {t('currentUser.awayMessages')}
              <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {awayMessagesCount}
              </span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={toggleDarkMode}>
            {isDarkMode ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Moon className="mr-2 h-4 w-4" />
            )}
            {isDarkMode ? t('currentUser.lightMode') : t('currentUser.darkMode')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {isConnected ? (
            <DropdownMenuItem onClick={() => resetAndGoToStart(true)}>
              <LogOut className="mr-2 h-4 w-4" />
              {t('currentUser.disconnect')}
            </DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuItem onClick={() => ircReconnect()} disabled={isConnecting}>
                <LogIn className="mr-2 h-4 w-4" />
                {isConnecting ? t('currentUser.connecting') : t('currentUser.connect')}
              </DropdownMenuItem>
              {!isConnecting && (
                <DropdownMenuItem onClick={changeServer}>
                  <ArrowLeftRight className="mr-2 h-4 w-4" />
                  {t('currentUser.changeServer')}
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {isAway && (
        <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500" aria-hidden="true">
          <Moon className="h-2.5 w-2.5 text-white" />
        </span>
      )}
      {awayMessagesCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1.5 items-center justify-center rounded-full bg-red-500 text-[10px] leading-none text-white font-medium" aria-label={t('main.toolbar.awayMessageCount', { count: awayMessagesCount })}>
          {awayMessagesCount > 99 ? '99+' : awayMessagesCount}
        </span>
      )}
    </div>
  );
};

export default UserMenu;
