import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Channels from '@features/channels/components/Channels';
import Chat from '@features/chat/components/Chat';
import Typing from '@features/chat/components/Typing';
import Toolbar from '@features/chat/components/Toolbar';
import Topic from '@features/chat/components/Topic';
import Users from '@features/users/components/Users';
import { ResizeHandle } from '@shared/components/ui/resize-handle';
import { channelsWidth as defaultChannelsWidth, usersWidth as defaultUsersWidth } from '@/config/theme';
import { useSettingsStore } from '@features/settings/store/settings';

function MainPage() {
  const { t } = useTranslation();
  const [channelsWidth, setChannelsWidth] = useState(defaultChannelsWidth);
  const [usersWidth, setUsersWidth] = useState(defaultUsersWidth);
  const hideTypingIndicator = useSettingsStore((state) => state.hideTypingIndicator);

  const handleChannelsResize = useCallback((delta: number) => {
    setChannelsWidth((prev) => Math.max(defaultChannelsWidth, prev + delta));
  }, []);

  const handleUsersResize = useCallback((delta: number) => {
    setUsersWidth((prev) => Math.max(defaultUsersWidth, prev + delta));
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-background focus:text-foreground">
        {t('a11y.skipToContent')}
      </a>
      <Channels width={channelsWidth} />
      <ResizeHandle onResize={handleChannelsResize} direction="right" className="hidden lg:block" aria-label={t('a11y.resizeChannels')} />
      <main id="main-content" className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Topic />
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <Chat />
          </div>
          {!hideTypingIndicator && <Typing />}
          <Toolbar />
        </div>
      </main>
      <ResizeHandle onResize={handleUsersResize} direction="left" className="hidden lg:block" aria-label={t('a11y.resizeUsers')} />
      <Users width={usersWidth} />
    </div>
  );
}

export default MainPage;
