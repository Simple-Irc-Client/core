import React from 'react';
import { Box, IconButton, Input } from '@mui/material';
import { useChannelsDrawer } from '../../../providers/ChannelsDrawerContext';
import MenuIcon from '@mui/icons-material/Menu';
import { useCurrentStore } from '../../../store/current';

const Topic = () => {
  const topic: string = useCurrentStore((state) => state.topic);

  const { setChannelsDrawerStatus } = useChannelsDrawer();

  return (
    <Box sx={{ paddingLeft: '16px', paddingRight: '16px', display: 'flex', height: '64px' }}>
      <IconButton color="inherit" onClick={setChannelsDrawerStatus} edge="start" sx={{ height: '48px', display: { md: 'none' } }}>
        <MenuIcon />
      </IconButton>
      <Input value={topic} disabled sx={{ marginBottom: '1rem', flexGrow: '1', minHeight: '48px' }} />
    </Box>
  );
};

export default Topic;
