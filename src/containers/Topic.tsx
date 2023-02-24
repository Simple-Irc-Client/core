import React from 'react';
import { Box, Input } from '@mui/material';
import { useChannelsStore } from '../store/channels';
import { useSettingsStore } from '../store/settings';

const Topic = (): JSX.Element => {
  const currentChannelName: string = useSettingsStore((state) => state.currentChannelName);
  const getTopic = useChannelsStore((state) => state.getTopic);

  return (
    <Box sx={{ paddingLeft: '16px', paddingRight: '16px', display: 'flex' }}>
      <Input value={getTopic(currentChannelName)} disabled sx={{ marginBottom: '1rem', flexGrow: '1', minHeight: '48px' }} />
    </Box>
  );
};

export default Topic;
