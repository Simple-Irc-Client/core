import { useEffect } from 'react';
import { Network } from './Network';

import './i18n';

import { ChannelsDrawerProvider } from '@/providers/ChannelsDrawerProvider';
import { ContextMenuProvider } from '@/providers/ContextMenuProvider';
import { ContextMenu } from '@/shared/components/ContextMenu';
import MainLayout from '@/layouts/MainLayout';
import { useSettingsStore } from '@features/settings/store/settings';

function App() {
  const isDarkMode = useSettingsStore((state) => state.isDarkMode);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

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
