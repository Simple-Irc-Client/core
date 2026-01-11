import { useEffect, useRef } from 'react';
import { useSettingsStore } from '../../../store/settings';
import { MessageCategory, type Message } from '../../../types';
import { format } from 'date-fns';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '../../../config/config';
import { MessageColor } from '../../../config/theme';
import { useCurrentStore } from '../../../store/current';

const MainViewDebug = ({ message }: { message: Message }) => (
  <div className="py-1 px-4">
    <code className="text-sm">
      <span style={{ color: MessageColor.time }}>{format(new Date(message.time), 'HH:mm:ss')}</span>
      &nbsp;
      {message?.nick !== undefined && <>&lt;{typeof message.nick === 'string' ? message.nick : message.nick.nick}&gt;&nbsp;</>}
      <span style={{ color: message.color ?? MessageColor.default }}>{message.message}</span>
    </code>
  </div>
);

const MainViewClassic = ({ message }: { message: Message }) => (
  <div className="py-1 px-4">
    <div className="text-sm">
      <span style={{ color: MessageColor.time }}>{format(new Date(message.time), 'HH:mm')}</span>
      &nbsp; &lt;
      {message?.nick !== undefined ? (typeof message.nick === 'string' ? message.nick : message.nick.nick) : ''}
      &gt; &nbsp;
      <span style={{ color: message.color ?? MessageColor.default }}>{message.message}</span>
    </div>
  </div>
);

const MainViewModern = ({ message, lastNick }: { message: Message; lastNick: string }) => {
  const nick = message.nick !== undefined ? (typeof message.nick === 'string' ? message.nick : message.nick.nick) : '';
  const avatar = message?.nick !== undefined ? (typeof message.nick === 'string' ? undefined : message.nick.avatar) : undefined;
  const avatarLetter = message?.nick !== undefined ? (typeof message.nick === 'string' ? message.nick.substring(0, 1) : message.nick.nick.substring(0, 1)) : '';
  const nickColor = message?.nick !== undefined ? (typeof message.nick === 'string' ? 'inherit' : message.nick.color) : 'inherit';

  // TODO fix notice message layout - currently there is no nick displayed

  return (
    <>
      {message.category !== MessageCategory.default && (
        <div className="py-1 px-4 pl-16" style={{ color: message.color ?? MessageColor.default }}>
          <div className="text-sm">{message.message}</div>
        </div>
      )}
      {message.category === MessageCategory.default && (
        <div className={`flex items-start px-4 ${lastNick === nick ? 'py-0' : 'py-2'}`}>
          <div className="w-10 mr-3 flex-shrink-0">
            {lastNick !== nick && (
              <div className="relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full">
                {avatar ? (
                  <img className="aspect-square h-full w-full" alt={nick} src={avatar} />
                ) : (
                  <span className="flex h-full w-full items-center justify-center rounded-full bg-gray-200">
                    {avatarLetter}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {lastNick !== nick && (
              <div className="flex items-baseline mb-1">
                <span className="font-medium text-sm" style={{ color: nickColor }}>
                  {nick}
                </span>
                <div className="flex-1" />
                <span className="text-xs min-w-fit ml-2" style={{ color: MessageColor.time }}>
                  {format(new Date(message.time), 'HH:mm')}
                </span>
              </div>
            )}
            <div style={{ color: message.color ?? MessageColor.default }}>
              {lastNick !== nick && <div className="text-sm">{message.message}</div>}
              {lastNick === nick && (
                <div className="flex items-baseline">
                  <div className="text-sm flex-1">{message.message}</div>
                  <span className="text-xs min-w-fit ml-2" style={{ color: MessageColor.time }}>
                    {format(new Date(message.time), 'HH:mm')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const Main = () => {
  const currentChannelName: string = useSettingsStore((state) => state.currentChannelName);
  const theme: string = useSettingsStore((state) => state.theme);
  const messages = useCurrentStore((state) => state.messages);

  let lastNick = '';

  const AlwaysScrollToBottom = () => {
    const elementRef = useRef<HTMLDivElement>(null);
    useEffect(() => elementRef.current?.scrollIntoView());
    return <div ref={elementRef} />;
  };

  return (
    <div className="h-full overflow-y-auto relative break-anywhere">
      <div className="pt-0 pb-0">
        {messages.map((message) => {
          const mainWindow = (
            <div key={`message-${message.id}`}>
              {[DEBUG_CHANNEL, STATUS_CHANNEL].includes(currentChannelName) && <MainViewDebug message={message} />}
              {![DEBUG_CHANNEL, STATUS_CHANNEL].includes(currentChannelName) && (
                <>
                  {theme === 'classic' && <MainViewClassic message={message} />}
                  {theme === 'modern' && <MainViewModern message={message} lastNick={lastNick} />}
                </>
              )}
            </div>
          );
          lastNick = message.nick !== undefined ? (typeof message.nick === 'string' ? message.nick : message.nick.nick) : '';
          return mainWindow;
        })}
        <AlwaysScrollToBottom />
      </div>
    </div>
  );
};

export default Main;
