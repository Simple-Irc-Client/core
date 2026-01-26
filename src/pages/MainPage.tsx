import { useCallback, useState } from 'react';
import Channels from '@features/channels/components/Channels';
import Chat from '@features/chat/components/Chat';
import Typing from '@features/chat/components/Typing';
import Toolbar from '@features/chat/components/Toolbar';
import Topic from '@features/chat/components/Topic';
import Users from '@features/users/components/Users';
import { ResizeHandle } from '@shared/components/ui/resize-handle';
import { channelsWidth as defaultChannelsWidth, usersWidth as defaultUsersWidth } from '@/config/theme';

function MainPage() {
  const [channelsWidth, setChannelsWidth] = useState(defaultChannelsWidth);
  const [usersWidth, setUsersWidth] = useState(defaultUsersWidth);

  const handleChannelsResize = useCallback((delta: number) => {
    setChannelsWidth((prev) => Math.max(defaultChannelsWidth, prev + delta));
  }, []);

  const handleUsersResize = useCallback((delta: number) => {
    setUsersWidth((prev) => Math.max(defaultUsersWidth, prev + delta));
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Channels width={channelsWidth} />
      <ResizeHandle onResize={handleChannelsResize} direction="right" className="hidden lg:block" />
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <Topic />
        <div className="flex-1 overflow-hidden">
          <Chat />
        </div>
        <Typing />
        <Toolbar />
      </div>
      <ResizeHandle onResize={handleUsersResize} direction="left" className="hidden sm:block" />
      <Users width={usersWidth} />
    </div>
  );
}

export default MainPage;
