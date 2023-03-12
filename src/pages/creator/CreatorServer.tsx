import React, { useState } from 'react';
import { Autocomplete, Box, Button, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { type Server, servers } from '../../models/servers';
import { useSettingsStore } from '../../store/settings';
import { ircConnect } from '../../network/network';

const CreatorServer = (): JSX.Element => {
  const { t } = useTranslation();

  const [server, formServer] = useState<Server | undefined>(undefined);
  const setServer = useSettingsStore.getState().setServer;
  const setCreatorStep = useSettingsStore.getState().setCreatorStep;
  const setIsConnecting = useSettingsStore.getState().setIsConnecting;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    handleClick();
  };

  const handleClick = (): void => {
    if (server !== undefined) {
      setServer(server);
      const nick = useSettingsStore.getState().nick;

      console.log('sending connect to irc command');
      ircConnect(server, nick);

      setIsConnecting(true);

      setCreatorStep('loading');
    }
  };

  return (
    <>
      <Typography component="h1" variant="h5" sx={{ textAlign: 'center' }}>
        {t('creator.server.title')}
      </Typography>
      <Box component="form" sx={{ mt: 3 }} onSubmit={handleSubmit}>
        <Autocomplete
          disablePortal
          options={servers}
          sx={{ width: 300 }}
          getOptionLabel={(option) => option?.network ?? ''}
          renderInput={(params) => <TextField {...params} label={t('creator.server.server')} />}
          renderOption={(props, option) => (
            <Box component="li" {...props}>
              {option.network}
            </Box>
          )}
          onChange={(event, newValue) => {
            if (newValue != null) {
              formServer(newValue);
            }
          }}
          noOptionsText={t('creator.server.message.no.options')}
        />
        <Button onClick={handleClick} type="button" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={server == null}>
          {t('creator.server.button.next')}
        </Button>
      </Box>
    </>
  );
};

export default CreatorServer;
