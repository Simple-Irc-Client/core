import React from 'react'
import {
  Avatar,
  Box,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText
} from '@mui/material'
import { useChannelsStore } from '../store/channels'
import { useSettingsStore } from '../store/settings'

const Main = (): JSX.Element => {
  const currentChannelName: string = useSettingsStore(
    (state) => state.currentChannelName
  )

  const channelsStore = useChannelsStore()

  return (
    <Box sx={{ height: '100%' }}>
      {channelsStore.getMessages(currentChannelName).map((message, index) => (
        <List key={`message-${index}`}>
          <ListItem alignItems="flex-start">
            <ListItemAvatar>
              <Avatar
                alt={message.nick?.nick ?? message.nick}
                src={message.nick?.avatarUrl}
              />
            </ListItemAvatar>
            <ListItemText primary={message.message} />
          </ListItem>
          <Divider variant="inset" component="li" />
        </List>
      ))}
    </Box>
  )
}

export default Main
