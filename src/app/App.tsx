import { Network } from './Network';

import './i18n';

import { ChannelsDrawerProvider } from '@/providers/ChannelsDrawerProvider';
import { ContextMenuProvider } from '@/providers/ContextMenuProvider';
import { ContextMenu } from '@/shared/components/ContextMenu';
import MainLayout from '@/layouts/MainLayout';

function App() {
  return (
    <ChannelsDrawerProvider>
      <ContextMenuProvider>
        <ContextMenu />
        <Network />
        <MainLayout />
      </ContextMenuProvider>
    </ChannelsDrawerProvider>
  );
}

export default App;
