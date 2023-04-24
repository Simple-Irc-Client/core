import React, { useEffect, useMemo, useState } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { DataGrid, type GridCellParams, type GridColDef, GridToolbarQuickFilter } from '@mui/x-data-grid';
import { useTranslation } from 'react-i18next';
import { ircJoinChannels } from '../../network/network';
import { useChannelsStore } from '../../store/channels';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '../../config/config';
import { setCreatorCompleted } from '../../store/settings';
import { getChannelListSortedByUsers, useChannelListStore } from '../../store/channelList';
import { type ChannelList } from '../../types';

const CreatorChannelList = (): JSX.Element => {
  const { t } = useTranslation();

  const isChannelListLoadingFinished = useChannelListStore((state) => state.finished);

  const openChannels = useChannelsStore((state) => state.openChannelsShortList);

  const [selectedChannels, updateSelectedChannel] = useState<string[]>([]);

  const [channelList, updateChannelsList] = useState<ChannelList[]>([]);

  useMemo(() => {
    updateChannelsList(isChannelListLoadingFinished ? getChannelListSortedByUsers() ?? [] : []);
  }, [isChannelListLoadingFinished]);

  const handleDelete = (channelName: string) => () => {
    updateSelectedChannel((channels) => channels.filter((channel) => channel !== channelName));
  };

  const handleClick = (params: GridCellParams): void => {
    updateSelectedChannel((channels) => [...channels, params.id.toString()]);
  };

  const handleSkip = (): void => {
    setCreatorCompleted(true);
  };

  const handleJoin = (): void => {
    ircJoinChannels(selectedChannels);
    setCreatorCompleted(true);
  };

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: t('creator.channels.column.name') ?? 'Name',
      width: 150,
    },
    {
      field: 'users',
      headerName: t('creator.channels.column.users') ?? 'Users',
      width: 100,
      filterable: false,
    },
    {
      field: 'topic',
      headerName: t('creator.channels.column.topic') ?? 'Topic',
      width: 500,
      sortable: false,
      filterable: false,
    },
  ];

  useEffect(() => {
    const diff = openChannels.filter((channel) => ![STATUS_CHANNEL, DEBUG_CHANNEL].includes(channel.name)).filter((channel) => !selectedChannels.includes(channel.name));
    if (diff.length !== 0) {
      updateSelectedChannel(
        selectedChannels.concat(
          diff.map((channel) => {
            return channel.name;
          })
        )
      );
    }
  }, [openChannels, selectedChannels]);

  return (
    <>
      <Typography component="h1" variant="h5" sx={{ textAlign: 'center' }}>
        {t('creator.channels.title')}
      </Typography>
      <Box component="div" sx={{ mt: 3, width: '100%' }}>
        {selectedChannels.map((channel) => (
          <Chip key={channel} label={channel} color="primary" variant="outlined" onDelete={handleDelete(channel)} />
        ))}
      </Box>
      <Box sx={{ mt: 3, width: '100%' }}>
        <div style={{ display: 'flex', height: 350, width: '100%' }}>
          <DataGrid
            loading={!isChannelListLoadingFinished}
            rows={channelList}
            disableColumnMenu={true}
            columns={columns}
            getRowId={(row) => row.name}
            initialState={{
              sorting: {
                sortModel: [{ field: 'users', sort: 'desc' }],
              },
            }}
            localeText={{
              noRowsLabel: t('creator.channels.loading') ?? 'No rows',
              noResultsOverlayLabel: t('creator.channels.toolbar.search.no.results') ?? 'No results found.',
              toolbarQuickFilterPlaceholder: t('creator.channels.toolbar.search.placeholder') ?? 'Search…',
              toolbarQuickFilterLabel: t('creator.channels.toolbar.search.label') ?? 'Search',
              toolbarQuickFilterDeleteIconLabel: t('creator.channels.toolbar.clear') ?? 'Clear',
            }}
            onCellClick={handleClick}
            components={{ Toolbar: GridToolbarQuickFilter }}
          />
        </div>
      </Box>
      <Stack spacing={2} direction="row" marginTop={2} justifyContent="center">
        <Button onClick={handleSkip} tabIndex={1} variant="contained" size="large">
          {t('creator.channels.button.skip')}
        </Button>
        <Button onClick={handleJoin} tabIndex={2} variant="contained" size="large" disabled={selectedChannels.length === 0}>
          {t('creator.channels.button.join')}
        </Button>
      </Stack>
    </>
  );
};

export default CreatorChannelList;
