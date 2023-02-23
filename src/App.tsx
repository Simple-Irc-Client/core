import React from 'react';
import Channels from './containers/Channels';
import Main from './containers/Main';
import Toolbar from './containers/Toolbar';
import Topic from './containers/Topic';
import Users from './containers/Users';
import Creator from './pages/creator/Creator';
import { useSettingsStore } from './store/settings';
import { AppNetwork } from './AppNetwork';

import { channelsWidth, usersWidth } from './config';

import './i18n';

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Container, Stack } from '@mui/material';

const theme = createTheme();

function App(): JSX.Element {
  const isCreatorCompleted = useSettingsStore((state) => state.isCreatorCompleted);

  const handleContextMenu = (event: React.MouseEvent): void => {
    event.preventDefault();
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppNetwork />
      <div onContextMenu={handleContextMenu}>
        {!isCreatorCompleted && <Creator />}
        {isCreatorCompleted && (
          <Container sx={{ minWidth: '100%', height: '100vh', padding: '0 !important' }}>
            <Stack direction="row" sx={{ height: '100vh' }}>
              <Channels />
              <Stack
                direction="column"
                height="100vh"
                sx={{ marginLeft: { xs: 0, md: `${channelsWidth}px` }, minWidth: { xs: '100%', sm: `calc(100% - ${usersWidth + 1}px)`, md: `calc(100% - ${channelsWidth + usersWidth + 1}px)` } }}
              >
                <Topic />
                <Main />
                <Toolbar />
              </Stack>
              <Users />
            </Stack>
          </Container>
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;
