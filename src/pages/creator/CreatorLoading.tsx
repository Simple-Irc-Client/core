import React, { useEffect, useRef, useState } from 'react';
import { Box, LinearProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ircConnect } from '../../network/network';
import { useSettingsStore } from '../../store/settings';

const CreatorLoading = (): JSX.Element => {
  const { t } = useTranslation();

  const [progress, setProgress] = useState({ value: 0, label: '' });

  const nick = useSettingsStore((state) => state.nick);
  const server = useSettingsStore((state) => state.server);
  const isConnecting = useSettingsStore((state) => state.isConnecting);
  const setIsConnecting = useSettingsStore((state) => state.setIsConnecting);
  const isConnected = useSettingsStore((state) => state.isConnected);
  const setCreatorStep = useSettingsStore((state) => state.setCreatorStep);

  const ircConnectRequested = useRef(false);

  useEffect(() => {
    if (server !== undefined && !isConnecting && !isConnected && !ircConnectRequested.current) {
      ircConnectRequested.current = true;
      console.log('sending connect to irc command');
      ircConnect(server, nick);
      setIsConnecting(true);
    }
    if (isConnecting) {
      setProgress({ value: 1, label: t('creator.loading.connecting') });
    }
    if (isConnected) {
      setProgress({ value: 2, label: t('creator.loading.connected') });

      setTimeout(() => {
        setProgress({
          value: 3,
          label: t('creator.loading.isPasswordRequired'),
        });
      }, 2_000); // 2 sec

      setTimeout(() => {
        const localSettings = useSettingsStore.getState();
        if (localSettings.isPasswordRequired === false || localSettings.isPasswordRequired === undefined) {
          setCreatorStep('channels');
        }
      }, 5_000); // 5 sec
    }
  }, [isConnecting, isConnected]);

  return (
    <>
      <Box sx={{ width: '100%', mt: 3 }}>
        <LinearProgress variant="determinate" value={progress.value * 30} />
        {progress.label !== '' && <h2 className="tw-text-center tw-mt-4">{progress.label}</h2>}
      </Box>
    </>
  );
};

export default CreatorLoading;
