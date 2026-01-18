import React from 'react';
import { AppNetwork } from './AppNetwork';

import './i18n';

import { ChannelsDrawerProvider } from './providers/ChannelsDrawerProvider';
import { ContextMenuProvider } from './providers/ContextMenuProvider';
import { ContextMenu } from './components/ContextMenu';
import MainLayout from './layouts/MainLayout';

function App() {
  return (
    <ChannelsDrawerProvider>
      <ContextMenuProvider>
        <ContextMenu />
        <AppNetwork />
        <MainLayout />
      </ContextMenuProvider>
    </ChannelsDrawerProvider>
  );
}

export default App;
