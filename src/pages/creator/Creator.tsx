import React from 'react';
import { Box, Container } from '@mui/material';
import { useSettingsStore } from '../../store/settings';
import CreatorChannelList from './CreatorChannelList';
import CreatorNick from './CreatorNick';
import CreatorPassword from './CreatorPassword';
import CreatorServer from './CreatorServer';
import CreatorLoading from './CreatorLoading';

const Creator = () => {
  const creatorStep = useSettingsStore((state) => state.creatorStep);

  return (
    <Container maxWidth={creatorStep === 'channels' ? 'md' : 'sm'}>
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {creatorStep === 'nick' && (
          <Box sx={{ marginTop: { xs: 'auto', md: '40%' }, marginBottom: 'auto' }}>
            <CreatorNick />
          </Box>
        )}
        {creatorStep === 'server' && (
          <Box sx={{ marginTop: { xs: 'auto', md: '40%' }, marginBottom: 'auto' }}>
            <CreatorServer />
          </Box>
        )}
        {creatorStep === 'password' && (
          <Box sx={{ marginTop: { xs: 'auto', md: '40%' }, marginBottom: 'auto' }}>
            <CreatorPassword />
          </Box>
        )}
        {creatorStep === 'loading' && (
          <Box sx={{ marginTop: { xs: 'auto', md: '40%' }, marginBottom: 'auto', width: '100%' }}>
            <CreatorLoading />
          </Box>
        )}
        {creatorStep === 'channels' && (
          <Box sx={{ marginTop: { xs: 'auto', md: '25%' }, marginBottom: 'auto', width: '100%' }}>
            <CreatorChannelList />
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default Creator;
