import Channels from '@features/channels/components/Channels';
import Chat from '@features/chat/components/Chat';
import Typing from '@features/chat/components/Typing';
import Toolbar from '@features/chat/components/Toolbar';
import Topic from '@features/chat/components/Topic';
import Users from '@features/users/components/Users';
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
