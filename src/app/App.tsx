import { useEffect } from 'react';
import { Network } from './Network';
import { initScripts } from '@features/scripts/runtime/ScriptManager';

import './i18n';

import { DrawersProvider } from '@/providers/DrawersProvider';
import { ContextMenuProvider } from '@/providers/ContextMenuProvider';
import { ContextMenu } from '@/shared/components/ContextMenu';
import MainLayout from '@/layouts/MainLayout';
import ThemeStyleInjector from '@features/themes/components/ThemeStyleInjector';
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

  // Starts enabled user scripts once the scripts store rehydrates;
  // the QuickJS engine is only fetched if at least one script is enabled
  useEffect(() => {
    initScripts();
  }, []);

  return (
    <DrawersProvider>
      <ContextMenuProvider>
        <ContextMenu />
        <ThemeStyleInjector />
        <Network />
        <MainLayout />
      </ContextMenuProvider>
    </DrawersProvider>
  );
}

export default App;
