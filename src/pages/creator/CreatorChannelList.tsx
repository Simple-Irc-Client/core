import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTranslation } from 'react-i18next';
import { ircJoinChannels } from '../../network/irc/network';
import { useChannelsStore } from '../../store/channels';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '../../config/config';
import { setCreatorCompleted } from '../../store/settings';
import { getChannelListSortedByUsers, useChannelListStore } from '../../store/channelList';
import { X } from 'lucide-react';

const CreatorChannelList = () => {
  const { t } = useTranslation();

  const isChannelListLoadingFinished = useChannelListStore((state) => state.finished);

  const openChannels = useChannelsStore((state) => state.openChannelsShortList);

  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);

  const [searchQuery, setSearchQuery] = useState('');

  const channelList = useMemo(
    () => (isChannelListLoadingFinished ? (getChannelListSortedByUsers() ?? []) : []),
    [isChannelListLoadingFinished]
  );

  const filteredChannelList = useMemo(() => {
    if (!searchQuery) return channelList;
    const query = searchQuery.toLowerCase();
    return channelList.filter(
      (channel) => channel.name.toLowerCase().includes(query) || channel.topic?.toLowerCase().includes(query)
    );
  }, [channelList, searchQuery]);

  const handleDelete = (channelName: string) => () => {
    setSelectedChannels((channels) => channels.filter((channel) => channel !== channelName));
  };

  const handleRowClick = (channelName: string): void => {
    if (!selectedChannels.includes(channelName)) {
      setSelectedChannels((channels) => [...channels, channelName]);
    }
  };

  const handleSkip = (): void => {
    setCreatorCompleted(true);
  };

  const handleJoin = (): void => {
    ircJoinChannels(selectedChannels);
    setCreatorCompleted(true);
  };

  useEffect(() => {
    const diff = openChannels.filter((channel) => ![STATUS_CHANNEL, DEBUG_CHANNEL].includes(channel.name)).filter((channel) => !selectedChannels.includes(channel.name));
    if (diff.length !== 0) {
      setSelectedChannels(
        selectedChannels.concat(
          diff.map((channel) => {
            return channel.name;
          }),
        ),
      );
    }
  }, [openChannels, selectedChannels]);

  return (
    <>
      <h1 className="text-2xl font-semibold text-center">{t('creator.channels.title')}</h1>
      <div className="mt-8 flex flex-wrap gap-2">
        {selectedChannels.map((channel) => (
          <Badge key={channel} variant="outline" className="px-3 py-1">
            {channel}
            <button onClick={handleDelete(channel)} className="ml-2 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="mt-8 space-y-4">
        <Input
          placeholder={t('creator.channels.toolbar.search.placeholder') ?? 'Search…'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        <div className="border rounded-lg" style={{ height: 350, overflow: 'auto' }}>
          {!isChannelListLoadingFinished ? (
            <div className="flex items-center justify-center h-full">
              <p>{t('creator.channels.loading')}</p>
            </div>
          ) : filteredChannelList.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p>{t('creator.channels.toolbar.search.no.results')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">{t('creator.channels.column.name')}</TableHead>
                  <TableHead className="w-[100px]">{t('creator.channels.column.users')}</TableHead>
                  <TableHead>{t('creator.channels.column.topic')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredChannelList.map((channel) => (
                  <TableRow
                    key={channel.name}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(channel.name)}
                  >
                    <TableCell className="font-medium">{channel.name}</TableCell>
                    <TableCell>{channel.users}</TableCell>
                    <TableCell className="truncate max-w-[500px]">{channel.topic}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
      <div className="flex justify-center gap-4 mt-4">
        <Button onClick={handleSkip} tabIndex={1} size="lg">
          {t('creator.channels.button.skip')}
        </Button>
        <Button onClick={handleJoin} tabIndex={2} size="lg" disabled={selectedChannels.length === 0}>
          {t('creator.channels.button.join')}
        </Button>
      </div>
    </>
  );
};

export default CreatorChannelList;
