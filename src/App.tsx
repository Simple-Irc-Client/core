import React, { useEffect } from 'react';
import Channels from './components/Channels';
import Main from './components/Main';
import Toolbar from './components/Toolbar';
import Topic from './components/Topic';
import Users from './components/Users';
import Creator from './pages/creator/Creator';
import { useSettingsStore } from './store/settings';
import { useChannelListStore } from './store/channelsList';
import { useChannelsStore } from './store/channels';
import { useUsersStore } from './store/users';

import './i18n';

import { sicSocket } from './network/network';
import { type IrcEvent, kernel } from './network/kernel';

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Container, Stack } from '@mui/material';
import { channelsWidth, usersWidth } from './config';

const theme = createTheme();

function App(): JSX.Element {
  const settingsStore = useSettingsStore();
  const channelsStore = useChannelsStore();
  const channelListStore = useChannelListStore();
  const usersStore = useUsersStore();

  useEffect(() => {
    const onIrcEvent = (data: IrcEvent): void => {
      kernel(settingsStore, channelsStore, channelListStore, usersStore, data);
    };

    sicSocket.on('sic-irc-event', onIrcEvent);
    return () => {
      sicSocket.off('sic-irc-event', onIrcEvent);
    };
  }, [sicSocket, settingsStore, channelsStore, channelListStore, usersStore]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {!settingsStore.isCreatorCompleted && <Creator />}
      {settingsStore.isCreatorCompleted && (
        <>
          <Container sx={{ minWidth: '100%', height: '100vh', padding: '0 !important' }}>
            <Stack direction="row">
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
        </>
      )}
    </ThemeProvider>
  );
}

export default App;
