import React, { useEffect, useState } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ircSendPassword } from '../../network/network';
import { useSettingsStore } from '../../store/settings';

const CreatorPassword = (): JSX.Element => {
  const { t } = useTranslation();
  const [lastNick, setLastNick] = useState('');
  const [password, setPassword] = useState('');

  const setCreatorStep = useSettingsStore.getState().setCreatorStep;
  const nick = useSettingsStore((state) => state.nick);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    handleClick();
  };

  const handleChange = (event: any): void => {
    setPassword(event.target.value);
  };

  const handleClick = (): void => {
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
      <Typography component="h1" variant="h5" sx={{ textAlign: 'center' }}>
        {t('creator.password.title')}
      </Typography>
      <Box component="form" sx={{ mt: 3 }} onSubmit={handleSubmit}>
        {lastNick !== nick && (
          <>
            <Typography align="center" variant="subtitle1">
              {t('creator.password.message.timeout1')}
            </Typography>
            <Typography align="center" variant="subtitle1">
              {t('creator.password.message.timeout2')}
            </Typography>
            <Typography align="center" variant="subtitle2">
              {t('creator.password.message.timeout3').replace('{{nick}}', lastNick)}
            </Typography>
            <Typography align="center" variant="subtitle2">
              {t('creator.password.message.timeout4')}
            </Typography>
          </>
        )}
        {lastNick === nick && (
          <>
            <TextField type="password" required fullWidth label={t('creator.password.password')} autoComplete="password" autoFocus onChange={handleChange} />
          </>
        )}
        <Button onClick={handleClick} type="button" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={lastNick === nick && password === ''}>
          {t('creator.password.button.next')}
        </Button>
      </Box>
    </>
  );
};

export default CreatorPassword;
