import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { X, Loader2 } from 'lucide-react';
import { useChannelSettingsStore, type ActiveListType, type ListEntry } from '@features/channels/store/channelSettings';
import { ircSendRawMessage } from '@/network/irc/network';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { getDateFnsLocale } from '@/shared/lib/dateLocale';

interface ListsTabProps {
  channelName: string;
}

const ListsTab = ({ channelName }: ListsTabProps) => {
  const { t } = useTranslation();
  const activeListType = useChannelSettingsStore((state) => state.activeListType);
  const setActiveListType = useChannelSettingsStore((state) => state.setActiveListType);
  const banList = useChannelSettingsStore((state) => state.banList);
  const exceptionList = useChannelSettingsStore((state) => state.exceptionList);
  const inviteList = useChannelSettingsStore((state) => state.inviteList);
  const isBanListLoading = useChannelSettingsStore((state) => state.isBanListLoading);
  const isExceptionListLoading = useChannelSettingsStore((state) => state.isExceptionListLoading);
  const isInviteListLoading = useChannelSettingsStore((state) => state.isInviteListLoading);

  const [newEntry, setNewEntry] = useState('');

  const getActiveList = (): ListEntry[] => {
    let list: ListEntry[];
    switch (activeListType) {
      case 'b':
        list = banList;
        break;
      case 'e':
        list = exceptionList;
        break;
      case 'I':
        list = inviteList;
        break;
      default:
        return [];
    }
    // Sort by setTime descending (latest first)
    return [...list].sort((a, b) => b.setTime - a.setTime);
  };

  const isActiveListLoading = (): boolean => {
    switch (activeListType) {
      case 'b':
        return isBanListLoading;
      case 'e':
        return isExceptionListLoading;
      case 'I':
        return isInviteListLoading;
      default:
        return false;
    }
  };

  const handleAddEntry = () => {
    if (newEntry.trim()) {
      ircSendRawMessage(`MODE ${channelName} +${activeListType} ${newEntry.trim()}`);
      setNewEntry('');
    }
  };

  const handleRemoveEntry = (mask: string) => {
    ircSendRawMessage(`MODE ${channelName} -${activeListType} ${mask}`);
  };

  const handleListTypeChange = (type: ActiveListType) => {
    setActiveListType(type);
  };

  const activeList = getActiveList();
  const isLoading = isActiveListLoading();

  const formatDate = (timestamp: number): string => {
    if (timestamp === 0) return '-';
    try {
      return format(new Date(timestamp * 1000), 'd MMM yyyy', { locale: getDateFnsLocale() });
    } catch {
      return '-';
    }
  };

  return (
    <div className="space-y-4 py-4">
      {/* List Type Tabs */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={activeListType === 'b' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleListTypeChange('b')}
          data-testid="list-type-bans"
        >
          {t('channelSettings.lists.bans')} ({banList.length})
        </Button>
        <Button
          type="button"
          variant={activeListType === 'e' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleListTypeChange('e')}
          data-testid="list-type-exceptions"
        >
          {t('channelSettings.lists.exceptions')} ({exceptionList.length})
        </Button>
        <Button
          type="button"
          variant={activeListType === 'I' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleListTypeChange('I')}
          data-testid="list-type-invites"
        >
          {t('channelSettings.lists.invites')} ({inviteList.length})
        </Button>
      </div>

      {/* List Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">{t('channelSettings.loading')}</span>
        </div>
      ) : (
        <div className="border rounded-md">
          {/* Header */}
          <div className="grid grid-cols-[1fr_100px_100px_40px] gap-2 p-2 border-b bg-muted text-sm font-medium">
            <div>{t('channelSettings.lists.mask')}</div>
            <div>{t('channelSettings.lists.setBy')}</div>
            <div>{t('channelSettings.lists.date')}</div>
            <div></div>
          </div>

          {/* List Items */}
          <div className="max-h-48 overflow-y-auto">
            {activeList.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {t('channelSettings.lists.empty')}
              </div>
            ) : (
              activeList.map((entry, index) => (
                <div
                  key={`${entry.mask}-${index}`}
                  className="grid grid-cols-[1fr_100px_100px_40px] gap-2 p-2 border-b last:border-b-0 items-center text-sm"
                >
                  <div className="truncate font-mono text-xs" title={entry.mask}>
                    {entry.mask}
                  </div>
                  <div className="truncate" title={entry.setBy}>
                    {entry.setBy || '-'}
                  </div>
                  <div>{formatDate(entry.setTime)}</div>
                  <div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleRemoveEntry(entry.mask)}
                      data-testid={`remove-entry-${index}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Add New Entry */}
      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={newEntry}
          onChange={(e) => setNewEntry(e.target.value)}
          className="flex-1"
          placeholder={t('channelSettings.lists.maskPlaceholder')}
          onKeyDown={(e) => e.key === 'Enter' && handleAddEntry()}
          data-testid="new-entry-input"
        />
        <Button type="button" size="sm" onClick={handleAddEntry} data-testid="add-entry">
          {t('channelSettings.actions.add')}
        </Button>
      </div>
    </div>
  );
};

export default ListsTab;
