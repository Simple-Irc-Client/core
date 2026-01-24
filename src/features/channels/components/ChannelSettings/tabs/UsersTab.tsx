import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Crown, ShieldCheck, Shield, ShieldHalf, Mic, ChevronDown } from 'lucide-react';
import { getUsersFromChannelSortedByMode, getCurrentUserChannelModes } from '@features/users/store/users';
import { useSettingsStore } from '@features/settings/store/settings';
import { ircSendRawMessage } from '@/network/irc/network';
import { Input } from '@shared/components/ui/input';
import { Button } from '@shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@shared/components/ui/dropdown-menu';
import type { User, UserMode } from '@shared/types';

interface UsersTabProps {
  channelName: string;
}

const getModeIcon = (flag: string, userModes: UserMode[]) => {
  const mode = userModes.find((m) => m.flag === flag);
  if (!mode) return null;

  switch (mode.symbol) {
    case '~':
      return <Crown className="h-4 w-4 text-yellow-500" />;
    case '&':
      return <ShieldCheck className="h-4 w-4 text-purple-500" />;
    case '@':
      return <Shield className="h-4 w-4 text-green-500" />;
    case '%':
      return <ShieldHalf className="h-4 w-4 text-blue-500" />;
    case '+':
      return <Mic className="h-4 w-4 text-gray-500" />;
    default:
      return null;
  }
};

const getModeLabel = (flag: string, t: (key: string) => string): string => {
  switch (flag) {
    case 'q':
      return t('channelSettings.users.owner');
    case 'a':
      return t('channelSettings.users.admin');
    case 'o':
      return t('channelSettings.users.operator');
    case 'h':
      return t('channelSettings.users.halfop');
    case 'v':
      return t('channelSettings.users.voice');
    default:
      return flag;
  }
};

const getModeLevel = (flags: string[]): number => {
  const hierarchy: Record<string, number> = {
    q: 5,
    a: 4,
    o: 3,
    h: 2,
    v: 1,
  };
  return Math.max(...flags.map((f) => hierarchy[f] ?? 0), 0);
};

const UsersTab = ({ channelName }: UsersTabProps) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const userModes = useSettingsStore((state) => state.userModes);
  const currentNick = useSettingsStore((state) => state.nick);

  const users = getUsersFromChannelSortedByMode(channelName);
  const currentUserModes = getCurrentUserChannelModes(channelName);
  const currentUserLevel = getModeLevel(currentUserModes);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter((user) => user.nick.toLowerCase().includes(query));
  }, [users, searchQuery]);

  const getUserChannelFlags = (user: User): string[] => {
    const channel = user.channels.find((ch) => ch.name === channelName);
    return channel?.flags ?? [];
  };

  const handleModeChange = (nick: string, flag: string, add: boolean) => {
    const mode = add ? `+${flag}` : `-${flag}`;
    ircSendRawMessage(`MODE ${channelName} ${mode} ${nick}`);
  };

  const canModify = (targetFlags: string[]): boolean => {
    const targetLevel = getModeLevel(targetFlags);
    return currentUserLevel > targetLevel;
  };

  const getHighestMode = (flags: string[]): string | null => {
    const order = ['q', 'a', 'o', 'h', 'v'];
    for (const flag of order) {
      if (flags.includes(flag)) return flag;
    }
    return null;
  };

  return (
    <div className="space-y-4 py-4">
      {/* Search */}
      <Input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t('channelSettings.users.search')}
        className="w-full"
        data-testid="user-search"
      />

      {/* Users List */}
      <div className="border rounded-md">
        {/* Header */}
        <div className="grid grid-cols-[1fr_120px_80px] gap-2 p-2 border-b bg-muted text-sm font-medium">
          <div>{t('channelSettings.users.user')}</div>
          <div>{t('channelSettings.users.status')}</div>
          <div>{t('channelSettings.users.actions')}</div>
        </div>

        {/* User Items */}
        <div className="max-h-64 overflow-y-auto">
          {filteredUsers.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t('channelSettings.users.noUsers')}
            </div>
          ) : (
            filteredUsers.map((user) => {
              const flags = getUserChannelFlags(user);
              const highestMode = getHighestMode(flags);
              const isCurrentUser = user.nick === currentNick;
              const canModifyUser = canModify(flags) && !isCurrentUser;

              return (
                <div
                  key={user.nick}
                  className="grid grid-cols-[1fr_120px_80px] gap-2 p-2 border-b last:border-b-0 items-center text-sm"
                >
                  <div className="flex items-center gap-2 truncate">
                    {highestMode && getModeIcon(highestMode, userModes)}
                    <span className="truncate" title={user.nick}>
                      {user.nick}
                    </span>
                    {isCurrentUser && (
                      <span className="text-xs text-muted-foreground">({t('channelSettings.users.you')})</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {highestMode ? getModeLabel(highestMode, t) : t('channelSettings.users.none')}
                  </div>
                  <div>
                    {canModifyUser ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7" data-testid={`user-actions-${user.nick}`}>
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {/* Grant modes */}
                          {currentUserLevel >= 2 && !flags.includes('v') && (
                            <DropdownMenuItem onClick={() => handleModeChange(user.nick, 'v', true)}>
                              {t('channelSettings.users.give')} {t('channelSettings.users.voice')}
                            </DropdownMenuItem>
                          )}
                          {currentUserLevel >= 3 && !flags.includes('h') && (
                            <DropdownMenuItem onClick={() => handleModeChange(user.nick, 'h', true)}>
                              {t('channelSettings.users.give')} {t('channelSettings.users.halfop')}
                            </DropdownMenuItem>
                          )}
                          {currentUserLevel >= 4 && !flags.includes('o') && (
                            <DropdownMenuItem onClick={() => handleModeChange(user.nick, 'o', true)}>
                              {t('channelSettings.users.give')} {t('channelSettings.users.operator')}
                            </DropdownMenuItem>
                          )}
                          {currentUserLevel >= 5 && !flags.includes('a') && (
                            <DropdownMenuItem onClick={() => handleModeChange(user.nick, 'a', true)}>
                              {t('channelSettings.users.give')} {t('channelSettings.users.admin')}
                            </DropdownMenuItem>
                          )}

                          {/* Separator if there are both grant and revoke options */}
                          {flags.length > 0 && <DropdownMenuSeparator />}

                          {/* Revoke modes */}
                          {flags.includes('v') && currentUserLevel >= 2 && (
                            <DropdownMenuItem onClick={() => handleModeChange(user.nick, 'v', false)}>
                              {t('channelSettings.users.remove')} {t('channelSettings.users.voice')}
                            </DropdownMenuItem>
                          )}
                          {flags.includes('h') && currentUserLevel >= 3 && (
                            <DropdownMenuItem onClick={() => handleModeChange(user.nick, 'h', false)}>
                              {t('channelSettings.users.remove')} {t('channelSettings.users.halfop')}
                            </DropdownMenuItem>
                          )}
                          {flags.includes('o') && currentUserLevel >= 4 && (
                            <DropdownMenuItem onClick={() => handleModeChange(user.nick, 'o', false)}>
                              {t('channelSettings.users.remove')} {t('channelSettings.users.operator')}
                            </DropdownMenuItem>
                          )}
                          {flags.includes('a') && currentUserLevel >= 5 && (
                            <DropdownMenuItem onClick={() => handleModeChange(user.nick, 'a', false)}>
                              {t('channelSettings.users.remove')} {t('channelSettings.users.admin')}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default UsersTab;
