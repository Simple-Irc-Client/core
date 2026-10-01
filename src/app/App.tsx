import { useEffect } from 'react';
import { Network } from './Network';

import './i18n';

import { DrawersProvider } from '@/providers/DrawersProvider';
import { ContextMenuProvider } from '@/providers/ContextMenuProvider';
import { ContextMenu } from '@/shared/components/ContextMenu';
import MainLayout from '@/layouts/MainLayout';
import ThemeStyleInjector from '@features/themes/components/ThemeStyleInjector';
import { useSettingsStore } from '@features/settings/store/settings';
import { handleNoContextMenu } from '@shared/components/GlobalInputContextMenu';

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
    // Must wrap ContextMenu too: React bubbles through the component tree, not Radix's portal DOM
    <div onContextMenu={handleNoContextMenu}>
      <DrawersProvider>
        <ContextMenuProvider>
          <ContextMenu />
          <ThemeStyleInjector />
          <Network />
          <MainLayout />
        </ContextMenuProvider>
      </DrawersProvider>
    </div>
  );
}

export default App;
