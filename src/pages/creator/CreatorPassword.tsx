import React, { useState } from 'react'
import { Box, Button, TextField, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { ircSendPassword } from '../../network/network'
import { useSettingsStore } from '../../store/settings'

const CreatorPassword = (): JSX.Element => {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')

  const setCreatorStep = useSettingsStore((state) => state.setCreatorStep)

  const onChange = (event: any): void => {
    setPassword(event.target.value)
  }

  const onClick = (): void => {
    ircSendPassword(password)
    setCreatorStep('channels')
  }

  return (
    <>
      <Typography component="h1" variant="h5">
        {t('creator.password.title')}
      </Typography>
      <Box component="form" sx={{ mt: 3 }}>
        <TextField
          type="password"
          required
          fullWidth
          label={t('creator.password.password')}
          autoComplete="password"
          autoFocus
          onChange={onChange}
        />
        <Button
          onClick={onClick}
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
          disabled={password === ''}
        >
          {t('creator.password.button.next')}
        </Button>
      </Box>
    </>
  )
}

export default CreatorPassword
