import MainPage from '@/pages/MainPage';
import WizardPage from '@features/wizard/pages/WizardPage';
import { useSettingsStore } from '@features/settings/store/settings';
import { GlobalInputContextMenu, handleNoContextMenu } from '@shared/components/GlobalInputContextMenu';

function App() {
  const isWizardCompleted = useSettingsStore((state) => state.isWizardCompleted);

  return (
    <div onContextMenu={handleNoContextMenu}>
      {!isWizardCompleted && <WizardPage />}
      {isWizardCompleted && <MainPage />}
      <GlobalInputContextMenu />
    </div>
  );
}

export default App;
