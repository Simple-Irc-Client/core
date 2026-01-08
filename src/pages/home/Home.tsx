import React from 'react';
import Channels from './components/Channels';
import Main from './components/Main';
import Typing from './components/Typing';
import Toolbar from './components/Toolbar';
import Topic from './components/Topic';
import Users from './components/Users';
import Creator from '../creator/Creator';
import { useSettingsStore } from '../../store/settings';

import { Box } from '@mui/material';

function App() {
  const isCreatorCompleted = useSettingsStore((state) => state.isCreatorCompleted);

  const handleNoContextMenu = (event: React.MouseEvent): void => {
    event.preventDefault();
  };

  return (
    <Box onContextMenu={handleNoContextMenu}>
      {!isCreatorCompleted && <Creator />}
      {isCreatorCompleted && (
        <Box sx={{ display: 'flex', height: '100vh' }}>
          <Box>
            <Channels />
          </Box>
          <Box height="calc(100vh - (64px + 28px + 60px))" width="100%">
            <Topic />
            <Main />
            <Typing />
            <Toolbar />
          </Box>
          <Users />
        </Box>
      )}
    </Box>
  );
}

export default App;
