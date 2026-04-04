import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useChannelsDrawer, useUsersDrawer } from '@/providers/DrawersContext';
import { Menu, Save, Users } from 'lucide-react';
import { useCurrentStore } from '@features/chat/store/current';
import { useSettingsStore } from '@features/settings/store/settings';
import { useUsersStore } from '@features/users/store/users';
import { getCurrentNick } from '@features/settings/store/settings';
import { getTopicSetBy, getTopicTime } from '@features/channels/store/channels';
import { ircSendRawMessage } from '@/network/irc/network';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/components/ui/tooltip';
import { format } from 'date-fns';
import { getDateFnsLocale } from '@/shared/lib/dateLocale';
import type { TFunction } from 'i18next';
import { parseIrcFormatting, renderFormattedSegments } from '@/shared/lib/ircFormatting';
import { getUserDisplayName } from '@shared/lib/displayName';
import ChannelSettingsButton from '@features/channels/components/ChannelSettings/ChannelSettingsButton';

const TOPIC_EDIT_FLAGS = new Set(['q', 'a', 'o']);

const formatTopicTooltip = (channelName: string, t: TFunction): string | undefined => {
  const topicSetBy = getTopicSetBy(channelName);
  const topicTime = getTopicTime(channelName);

  if (!topicSetBy || !topicTime) {
    return undefined;
  }

  const date = new Date(topicTime * 1000);
  return t('main.topic.setBy', {
    nick: getUserDisplayName(topicSetBy),
    date: format(date, 'd MMM yyyy HH:mm', { locale: getDateFnsLocale() }),
    interpolation: { escapeValue: false },
  });
};

// Inner component that resets when topic changes via key prop
const TopicInput = ({ topic, currentChannelName }: { topic: string; currentChannelName: string }) => {
  const { t } = useTranslation();
  const [editedTopic, setEditedTopic] = useState(topic);

  const canEditTopic = useUsersStore((state) => {
    const nick = getCurrentNick();
    const user = state.users.find((u) => u.nick === nick);
    const channel = user?.channels.find((ch) => ch.name === currentChannelName);
    return channel?.flags.some((flag) => TOPIC_EDIT_FLAGS.has(flag)) ?? false;
  });

  const handleSaveTopic = () => {
    if (editedTopic !== topic) {
      ircSendRawMessage(`TOPIC ${currentChannelName} :${editedTopic}`);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && canEditTopic) {
      handleSaveTopic();
    }
  };

  const topicTooltip = formatTopicTooltip(currentChannelName, t);
  const formattedSegments = parseIrcFormatting(topic);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex-1 min-w-0">
              {canEditTopic ? (
                <Input
                  data-testid="topic-input"
                  value={editedTopic}
                  onChange={(e) => setEditedTopic(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-8 h-8"
                  aria-label={t('main.topic.topicInput')}
                />
              ) : (
                <div data-testid="topic-display" className="min-h-8 w-full flex items-center px-3 text-sm truncate">
                  {renderFormattedSegments(formattedSegments)}
                </div>
              )}
            </div>
          </TooltipTrigger>
          {topicTooltip && <TooltipContent>{topicTooltip}</TooltipContent>}
        </Tooltip>
      </TooltipProvider>
      {canEditTopic && editedTopic !== topic && (
        <Button variant="ghost" onClick={handleSaveTopic} className="h-8 ml-2" aria-label={t('main.topic.saveTopic')}>
          <Save className="h-4 w-4" />
        </Button>
      )}
    </>
  );
};

const Topic = () => {
  const { t } = useTranslation();
  const topic: string = useCurrentStore((state) => state.topic);
  const currentChannelName = useSettingsStore((state) => state.currentChannelName);
  const currentChannelCategory = useSettingsStore((state) => state.currentChannelCategory);

  const { isChannelsDrawerOpen, setChannelsDrawerStatus } = useChannelsDrawer();
  const { isUsersDrawerOpen, setUsersDrawerStatus } = useUsersDrawer();

  const isDebugChannel = [DEBUG_CHANNEL, STATUS_CHANNEL].includes(currentChannelName);
  const showUsersToggle = currentChannelCategory === 'channel' || currentChannelCategory === 'priv';
  const isAnyDrawerOpen = isChannelsDrawerOpen || isUsersDrawerOpen;

  return (
    <div className="px-4 flex h-12 min-w-0 items-center border-b border-border">
      {!isAnyDrawerOpen && (
        <Button variant="ghost" onClick={setChannelsDrawerStatus} className="h-10 lg:hidden shrink-0 mr-2" aria-label={t('main.topic.toggleChannels')}>
          <Menu className="h-4 w-4" />
        </Button>
      )}
      <span className="font-semibold text-sm shrink-0">{currentChannelName}</span>
      {!isDebugChannel && (
        <>
          <span className="mx-2 text-border shrink-0" aria-hidden="true">|</span>
          <TopicInput key={topic} topic={topic} currentChannelName={currentChannelName} />
        </>
      )}
      {!isDebugChannel && !isAnyDrawerOpen && <ChannelSettingsButton channelName={currentChannelName} />}
      {showUsersToggle && !isAnyDrawerOpen && (
        <Button variant="ghost" onClick={setUsersDrawerStatus} className="h-10 lg:hidden shrink-0 ml-2" aria-label={t('main.topic.toggleUsers')}>
          <Users className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default Topic;
