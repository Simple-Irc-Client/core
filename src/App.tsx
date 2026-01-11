import React from 'react';
import { AppNetwork } from './AppNetwork';

import './i18n';

import { ChannelsDrawerProvider } from './providers/ChannelsDrawerProvider';
import { ContextMenuProvider } from './providers/ContextMenuProvider';
import { ContextMenu } from './components/ContextMenu';
import MainWindow from './pages/home/Home';

function App() {
  return (
    <ChannelsDrawerProvider>
      <ContextMenuProvider>
        <ContextMenu />
        <AppNetwork />
        <MainWindow />
      </ContextMenuProvider>
    </ChannelsDrawerProvider>
  );
}

export default App;
