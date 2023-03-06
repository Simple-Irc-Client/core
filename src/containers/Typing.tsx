import React from 'react';
import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../store/settings';
import { useChannelsStore } from '../store/channels';

const Typing = (): JSX.Element => {
  const { t } = useTranslation();

  const currentChannelName: string = useSettingsStore((state) => state.currentChannelName);

  const channelsStore = useChannelsStore();

  return (
    <Box sx={{ fontSize: '12px', height: '28px', marginLeft: '16px' }}>
      {channelsStore.getTyping(currentChannelName).length !== 0 && (
        <>
          {channelsStore.getTyping(currentChannelName).join(', ')}
          &nbsp;{t('main.user-typing')}
        </>
      )}
    </Box>
  );
};

export default Typing;
