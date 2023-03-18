import React, { useEffect, useState } from 'react';
import { Box, LinearProgress } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { getIsPasswordRequired, setCreatorStep, useSettingsStore } from '../../store/settings';

const CreatorLoading = (): JSX.Element => {
  const { t } = useTranslation();

  const [progress, setProgress] = useState({ value: 0, label: '' });

  const isConnecting = useSettingsStore((state) => state.isConnecting);
  const isConnected = useSettingsStore((state) => state.isConnected);

  useEffect(() => {
    if (isConnecting) {
      setProgress({ value: 1, label: t('creator.loading.connecting') });
    }

    if (isConnected) {
      setProgress({ value: 2, label: t('creator.loading.connected') });

      const timeout2 = setTimeout(() => {
        setProgress({
          value: 3,
          label: t('creator.loading.isPasswordRequired'),
        });
      }, 2_000); // 2 sec

      const timeout5 = setTimeout(() => {
        const isPasswordRequired = getIsPasswordRequired();
        if (isPasswordRequired === false || isPasswordRequired === undefined) {
          setCreatorStep('channels');
        }
      }, 5_000); // 5 sec

      return () => {
        clearTimeout(timeout2);
        clearTimeout(timeout5);
      };
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
