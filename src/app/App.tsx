import { useEffect } from 'react';
import { Network } from './Network';

import './i18n';

import { DrawersProvider } from '@/providers/DrawersProvider';
import { ContextMenuProvider } from '@/providers/ContextMenuProvider';
import { ContextMenu } from '@/shared/components/ContextMenu';
import MainLayout from '@/layouts/MainLayout';
import { useSettingsStore, disconnectOnly, setWizardCompleted } from '@features/settings/store/settings';
import { isGatewayMode } from '@/config/config';

function App() {
  const isDarkMode = useSettingsStore((state) => state.isDarkMode);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // In gateway mode (website), disconnect from the IRC server and reset the wizard
  // when the user closes or navigates away from the page, so the next visit starts fresh
  useEffect(() => {
    if (!isGatewayMode()) return;

    const handleBeforeUnload = (): void => {
      disconnectOnly();
      setWizardCompleted(false);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  return (
    <DrawersProvider>
      <ContextMenuProvider>
        <ContextMenu />
        <Network />
        <MainLayout />
      </ContextMenuProvider>
    </DrawersProvider>
  );
}

export default App;
