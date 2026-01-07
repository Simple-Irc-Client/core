import React from 'react';
import { AppNetwork } from './AppNetwork';

import './i18n';

import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ChannelsDrawerProvider } from './providers/ChannelsDrawerProvider';
import { ContextMenuProvider } from './providers/ContextMenuProvider';
import { ContextMenu } from './components/ContextMenu';
import MainWindow from './pages/home/Home';

const theme = createTheme();

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ChannelsDrawerProvider>
        <ContextMenuProvider>
          <ContextMenu />
          <AppNetwork />
          <MainWindow />
        </ContextMenuProvider>
      </ChannelsDrawerProvider>
    </ThemeProvider>
  );
}

export default App;
