import React, { useState } from 'react'
import { Box, Button, Chip, Stack, Typography } from '@mui/material'
import {
  DataGrid,
  type GridCellParams,
  type GridColDef,
  GridToolbarQuickFilter
} from '@mui/x-data-grid'
import { useTranslation } from 'react-i18next'
import { ircJoinChannels } from '../../network/network'
import { useChannelListStore } from '../../store/channelsList'
import { useSettingsStore } from '../../store/settings'

const CreatorChannelList = (): JSX.Element => {
  const { t } = useTranslation()

  const channels = useChannelListStore((state) => state.channels)
  const setCreatorCompleted = useSettingsStore(
    (state) => state.setCreatorCompleted
  )

  const [selectedChannels, updateSelectedChannel] = useState<string[]>([])

  const handleDelete = (channelName: string) => () => {
    updateSelectedChannel((channels) =>
      channels.filter((channel) => channel !== channelName)
    )
  }

  const handleClick = (params: GridCellParams): void => {
    updateSelectedChannel((channels) => [...channels, params.id.toString()])
  }

  const onSkip = (): void => {
    setCreatorCompleted(true)
  }

  const onJoin = (): void => {
    ircJoinChannels(selectedChannels)
    setCreatorCompleted(true)
  }

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: t('creator.channels.column.name') ?? 'Name',
      width: 150
    },
    {
      field: 'users',
      headerName: t('creator.channels.column.users') ?? 'Users',
      width: 100,
      filterable: false
    },
    {
      field: 'topic',
      headerName: t('creator.channels.column.topic') ?? 'Topic',
      width: 500,
      sortable: false,
      filterable: false
    }
  ]

  return (
    <>
      <Typography component="h1" variant="h5">
        {t('creator.channels.title')}
      </Typography>
      <Box component="form" sx={{ mt: 3, width: '100%' }}>
        {selectedChannels.map((channel) => (
          <Chip
            key={channel}
            label={channel}
            color="primary"
            variant="outlined"
            onDelete={handleDelete(channel)}
          />
        ))}
      </Box>
      <Box sx={{ mt: 3, width: '100%' }}>
        <div style={{ display: 'flex', height: 350, width: '100%' }}>
          <DataGrid
            loading={channels.length < 10}
            rows={channels.length > 10 ? channels : []}
            disableColumnMenu={true}
            columns={columns}
            pageSize={50}
            rowsPerPageOptions={[50]}
            getRowId={(row) => row.name}
            initialState={{
              sorting: {
                sortModel: [{ field: 'users', sort: 'desc' }]
              }
            }}
            localeText={{
              noRowsLabel: t('creator.channels.loading') ?? 'No rows',
              noResultsOverlayLabel:
                t('creator.channels.toolbar.search.no.results') ??
                'No results found.',
              toolbarQuickFilterPlaceholder:
                t('creator.channels.toolbar.search.placeholder') ?? 'Search…',
              toolbarQuickFilterLabel:
                t('creator.channels.toolbar.search.label') ?? 'Search',
              toolbarQuickFilterDeleteIconLabel:
                t('creator.channels.toolbar.clear') ?? 'Clear'
            }}
            onCellClick={handleClick}
            components={{ Toolbar: GridToolbarQuickFilter }}
          />
        </div>
      </Box>
      <Stack spacing={2} direction="row" marginTop={2}>
        <Button onClick={onSkip} tabIndex={1} variant="contained" size="large">
          {t('creator.channels.button.skip')}
        </Button>
        <Button onClick={onJoin} tabIndex={2} variant="contained" size="large">
          {t('creator.channels.button.join')}
        </Button>
      </Stack>
    </>
  )
}

export default CreatorChannelList
