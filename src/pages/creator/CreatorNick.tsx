import React, { useState } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { setCreatorStep, setNick } from '../../store/settings';

const CreatorNick = (): JSX.Element => {
  const { t } = useTranslation();

  const [nick, formNick] = useState('');

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    handleClick();
  };

  const handleClick = (): void => {
    if (nick.length !== 0) {
      setNick(nick);
      setCreatorStep('server');
    }
  };

  return (
    <>
      <Typography component="h1" variant="h5" sx={{ textAlign: 'center' }}>
        {t('creator.nick.title')}
      </Typography>
      <Box component="form" sx={{ mt: 3 }} onSubmit={handleSubmit}>
        <TextField
          required
          fullWidth
          aria-label={t('creator.nick.nick') ?? ''}
          label={t('creator.nick.nick')}
          autoComplete="nick"
          autoFocus
          onChange={(event) => {
            formNick(event.target.value);
          }}
          defaultValue={nick}
          tabIndex={1}
        />
        <Button onClick={handleClick} type="button" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }} disabled={nick === ''} tabIndex={2}>
          {t('creator.nick.button.next')}
        </Button>
      </Box>
    </>
  );
};

export default CreatorNick;
