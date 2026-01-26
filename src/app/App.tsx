import { useEffect } from 'react';
import { Network } from './Network';

import './i18n';

import { ChannelsDrawerProvider } from '@/providers/ChannelsDrawerProvider';
import { UsersDrawerProvider } from '@/providers/UsersDrawerProvider';
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
      <UsersDrawerProvider>
        <ContextMenuProvider>
          <ContextMenu />
          <Network />
          <MainLayout />
        </ContextMenuProvider>
      </UsersDrawerProvider>
    </ChannelsDrawerProvider>
  );
}

export default App;
