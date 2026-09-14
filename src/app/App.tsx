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
    // Suppresses the native OS context menu app-wide, including inside our own
    // DropdownMenu content. Radix portals its (sub)menu content to
    // document.body, but React bubbles synthetic events along the component
    // tree, not the DOM tree — so this handler must wrap ContextMenu itself,
    // not just MainLayout, or right-clicking within an open menu/submenu
    // (e.g. a submenu trigger) falls through to the native menu.
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
