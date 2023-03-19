import React from 'react';
import Channels from './containers/Channels';
import Main from './containers/Main';
import Typing from './containers/Typing';
import Toolbar from './containers/Toolbar';
import Topic from './containers/Topic';
import Users from './containers/Users';
import Creator from './pages/creator/Creator';
import { useSettingsStore } from './store/settings';
import { AppNetwork } from './AppNetwork';

import './i18n';

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box } from '@mui/material';
import { ChannelsDrawerProvider } from './providers/ChannelsDrawerProvider';
import { ContextMenuProvider } from './providers/ContextMenuProvider';
import { ContextMenu } from './components/ContextMenu';

const theme = createTheme();

function App(): JSX.Element {
  const isCreatorCompleted = useSettingsStore((state) => state.isCreatorCompleted);

  const handleNoContextMenu = (event: React.MouseEvent): void => {
    event.preventDefault();
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ChannelsDrawerProvider>
        <ContextMenuProvider>
          <ContextMenu />
          <AppNetwork />
          <Box onContextMenu={handleNoContextMenu}>
            {!isCreatorCompleted && <Creator />}
            {isCreatorCompleted && (
              <Box sx={{ display: 'flex' }}>
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
        </ContextMenuProvider>
      </ChannelsDrawerProvider>
    </ThemeProvider>
  );
}

export default App;
