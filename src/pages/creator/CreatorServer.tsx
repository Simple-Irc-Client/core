import React from 'react';
import { Autocomplete, Box, Button, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { servers } from '../../models/servers';
import { useSettingsStore } from '../../store/settings';

const CreatorServer = (): JSX.Element => {
  const { t } = useTranslation();

  const server = useSettingsStore((state) => state.server);
  const setServer = useSettingsStore((state) => state.setServer);
  const setCreatorStep = useSettingsStore((state) => state.setCreatorStep);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    handleClick();
  };

  const handleClick = (): void => {
    if (server !== undefined) {
      setCreatorStep('loading');
    }
  };

  return (
    <>
      <Typography component="h1" variant="h5">
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
              setServer(newValue);
            }
          }}
          noOptionsText={t('creator.server.message.no.options')}
        />
        <Button onClick={handleClick} type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={server == null}>
          {t('creator.server.button.next')}
        </Button>
      </Box>
    </>
  );
};

export default CreatorServer;
