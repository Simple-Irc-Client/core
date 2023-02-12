import React from 'react'
import { Input } from '@mui/material'
import { useChannelsStore } from '../store/channels'
import { useSettingsStore } from '../store/settings'

const Topic = (): JSX.Element => {
  const currentChannelName: string = useSettingsStore(
    (state) => state.currentChannelName
  )

  const channelsStore = useChannelsStore()

  return <Input value={channelsStore.getTopic(currentChannelName)} disabled />
}

export default Topic
