import Channels from '@features/channels/components/Channels';
import Chat from '@features/chat/components/Chat';
import Typing from '@features/chat/components/Typing';
import Toolbar from '@features/chat/components/Toolbar';
import Topic from '@features/chat/components/Topic';
import Users from '@features/users/components/Users';

function MainPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Channels />
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <Topic />
        <div className="flex-1 overflow-hidden">
          <Chat />
        </div>
        <Typing />
        <Toolbar />
      </div>
      <Users />
    </div>
  );
}

export default MainPage;
