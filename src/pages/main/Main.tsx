import React from 'react';
import Channels from '@/components/Channels';
import Chat from '@/components/Chat';
import Typing from '@/components/Typing';
import Toolbar from '@/components/Toolbar';
import Topic from '@/components/Topic';
import Users from '@/components/Users';
import { channelsColor } from '@/config/theme';

function Main() {
  return (
    <div className="flex h-screen">
      <div style={{ backgroundColor: channelsColor }}>
        <Channels />
      </div>
      {/* 64px - topic height */}
      {/* 28px - typing height */}
      {/* 48px - toolbar input height */}
      <div className="w-full" style={{ height: 'calc(100vh - (64px + 28px + 48px))' }}>
        <Topic />
        <Chat />
        <Typing />
        <Toolbar />
      </div>
      <Users />
    </div>
  );
}

export default Main;
