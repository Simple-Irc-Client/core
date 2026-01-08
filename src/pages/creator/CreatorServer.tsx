import React, { useState } from 'react';
import { Autocomplete, Box, Button, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { type Server, servers } from '../../network/irc/servers';
import { getCurrentNick, setCreatorStep, setIsConnecting, setServer } from '../../store/settings';
import { ircConnect } from '../../network/irc/network';

const CreatorServer = () => {
  const { t } = useTranslation();

  const [formServer, setFormServer] = useState<Server | undefined>(undefined);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    handleClick();
  };

  const handleClick = (): void => {
    if (formServer !== undefined) {
      setServer(formServer);
      const nick = getCurrentNick();

      console.log('sending connect to irc command');
      ircConnect(formServer, nick);

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
              setFormServer(newValue);
            }
          }}
          noOptionsText={t('creator.server.message.no.options')}
        />
        <Button onClick={handleClick} type="button" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={formServer == null}>
          {t('creator.server.button.next')}
        </Button>
      </Box>
    </>
  );
};

export default CreatorServer;
