import React from 'react';
import Main from '@/pages/MainPage';
import WizardPage from '@features/wizard/pages/WizardPage';
import { useSettingsStore } from '@features/settings/store/settings';

function App() {
  const isWizardCompleted = useSettingsStore((state) => state.isWizardCompleted);

  const handleNoContextMenu = (event: React.MouseEvent): void => {
    event.preventDefault();
  };

  return (
    <div onContextMenu={handleNoContextMenu}>
      {!isWizardCompleted && <WizardPage />}
      {isWizardCompleted && <Main />}
    </div>
  );
}

export default App;
