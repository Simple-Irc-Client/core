import React, { useEffect, useState } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ircSendPassword } from '../../network/network';
import { useSettingsStore } from '../../store/settings';

const CreatorPassword = (): JSX.Element => {
  const { t } = useTranslation();
  const [lastNick, setLastNick] = useState('');
  const [password, setPassword] = useState('');

  const setCreatorStep = useSettingsStore((state) => state.setCreatorStep);
  const nick = useSettingsStore((state) => state.nick);

  const onChange = (event: any): void => {
    setPassword(event.target.value);
  };

  const onClick = (): void => {
    if (lastNick === nick) {
      ircSendPassword(password);
    }
    setCreatorStep('channels');
  };

  useEffect(() => {
    if (lastNick === '') {
      setLastNick(nick);
    }
  }, [nick]);

  return (
    <>
      <Typography component="h1" variant="h5">
        {t('creator.password.title')}
      </Typography>
      <Box component="form" sx={{ mt: 3 }}>
        {lastNick !== nick && (
          <>
            <Typography align="center" variant="subtitle1">
              {t('creator.password.message.timeout1')}
            </Typography>
            <Typography align="center" variant="subtitle1">
              {t('creator.password.message.timeout2')}
            </Typography>
            <Typography align="center" variant="subtitle2">
              {t('creator.password.message.timeout3').replace('{nick}', lastNick)}
            </Typography>
            <Typography align="center" variant="subtitle2">
              {t('creator.password.message.timeout4')}
            </Typography>
          </>
        )}
        {lastNick === nick && (
          <>
            <TextField type="password" required fullWidth label={t('creator.password.password')} autoComplete="password" autoFocus onChange={onChange} />
          </>
        )}
        <Button onClick={onClick} type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={lastNick === nick && password === ''}>
          {t('creator.password.button.next')}
        </Button>
      </Box>
    </>
  );
};

export default CreatorPassword;
