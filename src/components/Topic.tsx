import { useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useChannelsDrawer } from '@/providers/ChannelsDrawerContext';
import { Menu, Save } from 'lucide-react';
import { useCurrentStore } from '@/store/current';
import { useSettingsStore } from '@/store/settings';
import { getCurrentUserChannelModes } from '@/store/users';
import { getTopicSetBy, getTopicTime } from '@/store/channels';
import { ircSendRawMessage } from '@/network/irc/network';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '@/config/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import type { TFunction } from 'i18next';

const TOPIC_EDIT_FLAGS = ['q', 'a', 'o'];

const formatTopicTooltip = (channelName: string, t: TFunction): string | undefined => {
  const topicSetBy = getTopicSetBy(channelName);
  const topicTime = getTopicTime(channelName);

  if (!topicSetBy || !topicTime) {
    return undefined;
  }

  const date = new Date(topicTime * 1000);
  return t('main.topic.setBy', { nick: topicSetBy, date: format(date, 'dd/MMM/yyyy HH:mm') });
};

// Inner component that resets when topic changes via key prop
const TopicInput = ({ topic, currentChannelName }: { topic: string; currentChannelName: string }) => {
  const { t } = useTranslation();
  const [editedTopic, setEditedTopic] = useState(topic);

  const userFlags = getCurrentUserChannelModes(currentChannelName);
  const canEditTopic = userFlags.some((flag) => TOPIC_EDIT_FLAGS.includes(flag));

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

  return (
    <>
      <Input
        value={editedTopic}
        onChange={(e) => setEditedTopic(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={!canEditTopic}
        className="mb-4 mt-1 flex-1 min-h-12"
        title={topicTooltip}
      />
      {canEditTopic && editedTopic !== topic && (
        <Button variant="ghost" onClick={handleSaveTopic} className="h-12 ml-2">
          <Save className="h-4 w-4" />
        </Button>
      )}
    </>
  );
};

const Topic = () => {
  const topic: string = useCurrentStore((state) => state.topic);
  const currentChannelName = useSettingsStore((state) => state.currentChannelName);

  const { setChannelsDrawerStatus } = useChannelsDrawer();

  const isDebugChannel = [DEBUG_CHANNEL, STATUS_CHANNEL].includes(currentChannelName);

  return (
    <div className="px-4 flex h-16">
      <Button variant="ghost" onClick={setChannelsDrawerStatus} className="h-12 md:hidden">
        <Menu className="h-4 w-4" />
      </Button>
      {!isDebugChannel && <TopicInput key={topic} topic={topic} currentChannelName={currentChannelName} />}
    </div>
  );
};

export default Topic;
