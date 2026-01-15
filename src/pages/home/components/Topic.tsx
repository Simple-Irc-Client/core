import { useState, useEffect, type KeyboardEvent } from 'react';
import { useChannelsDrawer } from '../../../providers/ChannelsDrawerContext';
import { Menu, Save } from 'lucide-react';
import { useCurrentStore } from '../../../store/current';
import { useSettingsStore } from '../../../store/settings';
import { getCurrentUserChannelModes } from '../../../store/users';
import { ircSendRawMessage } from '../../../network/irc/network';
import { DEBUG_CHANNEL, STATUS_CHANNEL } from '../../../config/config';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const TOPIC_EDIT_FLAGS = ['q', 'a', 'o'];

const Topic = () => {
  const topic: string = useCurrentStore((state) => state.topic);
  const currentChannelName = useSettingsStore((state) => state.currentChannelName);
  const [editedTopic, setEditedTopic] = useState(topic);

  const userFlags = getCurrentUserChannelModes(currentChannelName);
  const canEditTopic = userFlags.some((flag) => TOPIC_EDIT_FLAGS.includes(flag));

  useEffect(() => {
    setEditedTopic(topic);
  }, [topic]);

  const { setChannelsDrawerStatus } = useChannelsDrawer();

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

  const isDebugChannel = [DEBUG_CHANNEL, STATUS_CHANNEL].includes(currentChannelName);

  return (
    <div className="px-4 flex h-16">
      <Button variant="ghost" onClick={setChannelsDrawerStatus} className="h-12 md:hidden">
        <Menu className="h-4 w-4" />
      </Button>
      {!isDebugChannel && (
        <>
          <Input
            value={editedTopic}
            onChange={(e) => setEditedTopic(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!canEditTopic}
            className="mb-4 mt-1 flex-1 min-h-12"
          />
          {canEditTopic && editedTopic !== topic && (
            <Button variant="ghost" onClick={handleSaveTopic} className="h-12 ml-2">
              <Save className="h-4 w-4" />
            </Button>
          )}
        </>
      )}
    </div>
  );
};

export default Topic;
