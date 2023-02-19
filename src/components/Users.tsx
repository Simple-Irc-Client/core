import React from 'react';
import { useUsersStore } from '../store/users';
import { useSettingsStore } from '../store/settings';
import { ChannelCategory } from '../types';
import { Avatar, Box, List, ListItemAvatar, ListItemButton, ListItemText, ListSubheader } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { usersColor, usersTitleColor, usersWidth } from '../config';

const Users = (): JSX.Element => {
  const { t } = useTranslation();

  const usersStore = useUsersStore();

  const currentChannelName: string = useSettingsStore((state) => state.currentChannelName);
  const currentChannelCategory: ChannelCategory = useSettingsStore((state) => state.currentChannelCategory);

  return (
    <Box sx={{ display: { xs: 'none', sm: 'block' }, borderLeft: '1px solid #eeeeee' }}>
      {[ChannelCategory.channel, ChannelCategory.priv].includes(currentChannelCategory) && (
        <List
          subheader={
            <ListSubheader component="div" sx={{ backgroundColor: usersTitleColor, marginBottom: '1rem' }}>
              {t('main.users.title')}
            </ListSubheader>
          }
          dense={true}
          sx={{
            minWidth: `${usersWidth}px`,
            backgroundColor: usersColor,
          }}
        >
          {usersStore.getUsersFromChannel(currentChannelName).map((user) => (
            <ListItemButton key={user.nick}>
              <ListItemAvatar>
                <Avatar alt={user.nick} src={user.avatar} />
              </ListItemAvatar>
              <ListItemText primary={user.nick} sx={{ color: user.color ?? 'inherit' }} />
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  );
};

export default Users;
