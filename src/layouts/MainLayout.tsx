import { lazy, Suspense } from 'react';
import { useSettingsStore } from '@features/settings/store/settings';
import { GlobalInputContextMenu } from '@shared/components/GlobalInputContextMenu';

const MainPage = lazy(() => import('@/pages/MainPage'));
const WizardPage = lazy(() => import('@features/wizard/pages/WizardPage'));

function App() {
  const isWizardCompleted = useSettingsStore((state) => state.isWizardCompleted);

  return (
    <>
      <Suspense>
        {!isWizardCompleted && <WizardPage />}
        {isWizardCompleted && <MainPage />}
      </Suspense>
      <GlobalInputContextMenu />
    </>
  );
}

export default App;
