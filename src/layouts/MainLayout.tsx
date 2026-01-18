import React from 'react';
import Main from '../pages/main/Main';
import Creator from '../pages/creator/Creator';
import { useSettingsStore } from '../store/settings';

function App() {
  const isCreatorCompleted = useSettingsStore((state) => state.isCreatorCompleted);

  const handleNoContextMenu = (event: React.MouseEvent): void => {
    event.preventDefault();
  };

  return (
    <div onContextMenu={handleNoContextMenu}>
      {!isCreatorCompleted && <Creator />}
      {isCreatorCompleted && <Main />}
    </div>
  );
}

export default App;
