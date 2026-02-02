import { useMemo, useState, useCallback } from 'react';
import { Button } from '@shared/components/ui/button';
import { useTranslation } from 'react-i18next';
import { ircJoinChannels } from '@/network/irc/network';
import { useChannelsStore } from '@features/channels/store/channels';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { setWizardCompleted } from '@features/settings/store/settings';
import { getChannelListSortedByUsers, useChannelListStore } from '@features/channels/store/channelList';
import ChannelListTable from '@shared/components/ChannelListTable';

const WizardChannelList = () => {
  const { t } = useTranslation();

  const isChannelListLoadingFinished = useChannelListStore((state) => state.finished);

  const openChannels = useChannelsStore((state) => state.openChannelsShortList);

  // Channels that user manually added (via clicking rows)
  const [manuallySelectedChannels, setManuallySelectedChannels] = useState<string[]>([]);

  const channelList = useMemo(
    () => (isChannelListLoadingFinished ? (getChannelListSortedByUsers() ?? []) : []),
    [isChannelListLoadingFinished]
  );

  // Derive selectedChannels from openChannels + manuallySelectedChannels
  const selectedChannels = useMemo(() => {
    const fromOpen = openChannels
      .filter((channel) => ![STATUS_CHANNEL, DEBUG_CHANNEL].includes(channel.name))
      .map((channel) => channel.name);
    const combined = new Set([...fromOpen, ...manuallySelectedChannels]);
    return Array.from(combined);
  }, [openChannels, manuallySelectedChannels]);

  const handleSelectionChange = useCallback((channels: string[]) => {
    // Only update manually selected channels (exclude auto-selected from open channels)
    const fromOpen = openChannels
      .filter((channel) => ![STATUS_CHANNEL, DEBUG_CHANNEL].includes(channel.name))
      .map((channel) => channel.name);
    const manualOnly = channels.filter((ch) => !fromOpen.includes(ch));
    setManuallySelectedChannels(manualOnly);
  }, [openChannels]);

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
        <Button onClick={handleSkip} tabIndex={1} size="lg">
          {t('wizard.channels.button.skip')}
        </Button>
        <Button onClick={handleJoin} tabIndex={2} size="lg" disabled={selectedChannels.length === 0}>
          {t('wizard.channels.button.join')}
        </Button>
      </div>
    </>
  );
};

export default WizardChannelList;
