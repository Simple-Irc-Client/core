import { lazy, Suspense } from 'react';
import { useSettingsStore } from '@features/settings/store/settings';
import { GlobalInputContextMenu, handleNoContextMenu } from '@shared/components/GlobalInputContextMenu';

const MainPage = lazy(() => import('@/pages/MainPage'));
const WizardPage = lazy(() => import('@features/wizard/pages/WizardPage'));

function App() {
  const isWizardCompleted = useSettingsStore((state) => state.isWizardCompleted);

  return (
    <div onContextMenu={handleNoContextMenu}>
      <Suspense>
        {!isWizardCompleted && <WizardPage />}
        {isWizardCompleted && <MainPage />}
      </Suspense>
      <GlobalInputContextMenu />
    </div>
  );
}

export default App;
