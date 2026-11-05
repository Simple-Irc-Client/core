import { lazy, Suspense } from 'react';
import { useSettingsStore } from '@features/settings/store/settings';
import { GlobalInputContextMenu } from '@shared/components/GlobalInputContextMenu';
import { LoadFailedBoundary } from '@shared/components/LoadFailedBoundary';

const MainPage = lazy(() => import('@/pages/MainPage'));
const WizardPage = lazy(() => import('@features/wizard/pages/WizardPage'));

function App() {
  const isWizardCompleted = useSettingsStore((state) => state.isWizardCompleted);

  return (
    <>
      <LoadFailedBoundary layout="page">
        <Suspense>
          {!isWizardCompleted && <WizardPage />}
          {isWizardCompleted && <MainPage />}
        </Suspense>
      </LoadFailedBoundary>
      <GlobalInputContextMenu />
    </>
  );
}

export default App;
