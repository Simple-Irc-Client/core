import React from 'react';
import Channels from './components/Channels';
import Main from './components/Main';
import Typing from './components/Typing';
import Toolbar from './components/Toolbar';
import Topic from './components/Topic';
import Users from './components/Users';
import Creator from '../creator/Creator';
import { useSettingsStore } from '../../store/settings';
import { channelsColor } from '@/config/theme';

function App() {
  const isCreatorCompleted = useSettingsStore((state) => state.isCreatorCompleted);

  const handleNoContextMenu = (event: React.MouseEvent): void => {
    event.preventDefault();
  };

  return (
    <div onContextMenu={handleNoContextMenu}>
      {!isCreatorCompleted && <Creator />}
      {isCreatorCompleted && (
        <div className="flex h-screen">
          <div style={{backgroundColor: channelsColor}}>
            <Channels />
          </div>
          {/* 64px - topic height */}
          {/* 28px - typing height */}
          {/* 48px - toolbar input height */}
          <div className="w-full" style={{ height: 'calc(100vh - (64px + 28px + 48px))' }}>
            <Topic />
            <Main />
            <Typing />
            <Toolbar />
          </div>
          <Users />
        </div>
      )}
    </div>
  );
}

export default App;
