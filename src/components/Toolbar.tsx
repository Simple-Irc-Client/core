import React from 'react'
import { TextField } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '../store/settings'
import { ChannelCategory } from '../types'

const Toolbar = (): JSX.Element => {
  const { t } = useTranslation()

  const currentChannelName: string = useSettingsStore(
    (state) => state.currentChannelName
  )
  const currentChannelCategory: ChannelCategory = useSettingsStore(
    (state) => state.currentChannelCategory
  )

  return (
    <TextField
      label={
        currentChannelCategory === ChannelCategory.priv
          ? `${t('main.toolbar.write.person')} ${currentChannelName}`
          : `${t('main.toolbar.write.channel')} ${currentChannelName}`
      }
      multiline
      variant="standard"
    />
  )
}

export default Toolbar
