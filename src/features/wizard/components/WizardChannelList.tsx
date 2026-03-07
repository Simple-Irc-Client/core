import { useMemo, useState, useCallback } from 'react';
import { Button } from '@shared/components/ui/button';
import { useTranslation } from 'react-i18next';
import { ircJoinChannels } from '@/network/irc/network';
import { setWizardCompleted } from '@features/settings/store/settings';
import { getChannelListSortedByUsers, useChannelListStore } from '@features/channels/store/channelList';
import { getChannelsToAutoJoin } from '@features/channels/store/channels';
import ChannelListTable from '@shared/components/ChannelListTable';

const WizardChannelList = () => {
  const { t } = useTranslation();

  const isChannelListLoadingFinished = useChannelListStore((state) => state.finished);

  const [selectedChannels, setSelectedChannels] = useState<string[]>(() => getChannelsToAutoJoin());

  const channelList = useMemo(
    () => (isChannelListLoadingFinished ? (getChannelListSortedByUsers() ?? []) : []),
    [isChannelListLoadingFinished]
  );

  const handleSelectionChange = useCallback((channels: string[]) => {
    setSelectedChannels(channels);
  }, []);

  const handleSkip = (): void => {
    setWizardCompleted(true);
  };

  const handleJoin = (): void => {
    ircJoinChannels(selectedChannels);
    setWizardCompleted(true);
  };

  const translations = {
    searchPlaceholder: t('wizard.channels.toolbar.search.placeholder') ?? 'Search',
    loading: t('wizard.channels.loading'),
    noResults: t('wizard.channels.toolbar.search.no.results'),
    columnName: t('wizard.channels.column.name'),
    columnUsers: t('wizard.channels.column.users'),
    columnTopic: t('wizard.channels.column.topic'),
  };

  return (
    <>
      <h1 className="text-2xl font-semibold text-center">{t('wizard.channels.title')}</h1>
      <div className="mt-8">
        <ChannelListTable
          channelList={channelList}
          isLoading={!isChannelListLoadingFinished}
          selectedChannels={selectedChannels}
          onSelectionChange={handleSelectionChange}
          height={350}
          translations={translations}
        />
      </div>
      <div className="flex justify-center gap-4 mt-4">
        {selectedChannels.length === 0 && (
          <Button onClick={handleSkip} size="lg">
            {t('wizard.channels.button.skip')}
          </Button>
        )}
        <Button onClick={handleJoin} size="lg" disabled={selectedChannels.length === 0}>
          {t('wizard.channels.button.join')}
        </Button>
      </div>
    </>
  );
};

export default WizardChannelList;
