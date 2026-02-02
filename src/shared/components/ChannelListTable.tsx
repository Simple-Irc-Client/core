import { useMemo, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@shared/components/ui/badge';
import { Input } from '@shared/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@shared/components/ui/table';
import type { ChannelList } from '@shared/types';

interface ChannelListTableProps {
  channelList: ChannelList[];
  isLoading: boolean;
  selectedChannels: string[];
  onSelectionChange: (channels: string[]) => void;
  excludeChannels?: string[];
  height?: number;
  translations?: {
    searchPlaceholder?: string;
    loading?: string;
    noResults?: string;
    columnName?: string;
    columnUsers?: string;
    columnTopic?: string;
  };
}

const ChannelListTable = ({
  channelList,
  isLoading,
  selectedChannels,
  onSelectionChange,
  excludeChannels = [],
  height = 300,
  translations,
}: ChannelListTableProps) => {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  const labels = {
    searchPlaceholder: translations?.searchPlaceholder ?? t('channelListDialog.search.placeholder') ?? 'Search...',
    loading: translations?.loading ?? t('channelListDialog.loading'),
    noResults: translations?.noResults ?? t('channelListDialog.noResults'),
    columnName: translations?.columnName ?? t('channelListDialog.column.name'),
    columnUsers: translations?.columnUsers ?? t('channelListDialog.column.users'),
    columnTopic: translations?.columnTopic ?? t('channelListDialog.column.topic'),
  };

  const availableChannelList = useMemo(() => {
    return channelList.filter((channel) => !excludeChannels.includes(channel.name));
  }, [channelList, excludeChannels]);

  const filteredChannelList = useMemo(() => {
    if (!searchQuery) return availableChannelList;
    const query = searchQuery.toLowerCase();
    return availableChannelList.filter(
      (channel) => channel.name.toLowerCase().includes(query) || channel.topic?.toLowerCase().includes(query)
    );
  }, [availableChannelList, searchQuery]);

  const handleRowClick = useCallback((channelName: string): void => {
    if (!selectedChannels.includes(channelName)) {
      onSelectionChange([...selectedChannels, channelName]);
    }
  }, [selectedChannels, onSelectionChange]);

  const handleDelete = useCallback((channelName: string) => () => {
    onSelectionChange(selectedChannels.filter((channel) => channel !== channelName));
  }, [selectedChannels, onSelectionChange]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 min-h-[32px]">
        {selectedChannels.map((channel) => (
          <Badge key={channel} variant="outline" className="px-3 py-1">
            {channel}
            <button onClick={handleDelete(channel)} className="ml-2 hover:text-destructive" aria-label={`Remove ${channel}`}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        placeholder={labels.searchPlaceholder}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="max-w-sm"
      />
      <div className="border rounded-lg" style={{ height, overflow: 'auto' }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p>{labels.loading}</p>
          </div>
        ) : filteredChannelList.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p>{labels.noResults}</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">{labels.columnName}</TableHead>
                <TableHead className="w-[100px]">{labels.columnUsers}</TableHead>
                <TableHead>{labels.columnTopic}</TableHead>
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
                  <TableCell className="truncate max-w-[300px]">{channel.topic}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default ChannelListTable;
