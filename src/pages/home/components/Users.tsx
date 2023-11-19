import React from 'react';
import { useSettingsStore } from '../../../store/settings';
import { ChannelCategory } from '../../../types';
import { Avatar, Box, List, ListItemAvatar, ListItemButton, ListItemText, ListSubheader } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { usersColor, usersTitleColor, usersWidth } from '../../../config/theme';
import { useCurrentStore } from '../../../store/current';
import { useContextMenu } from '../../../providers/ContextMenuContext';

const Users = (): JSX.Element => {
  const { t } = useTranslation();

  const { handleContextMenuUserClick } = useContextMenu();

  const currentChannelCategory: ChannelCategory = useSettingsStore((state) => state.currentChannelCategory);
  const users = useCurrentStore((state) => state.users);

  return (
    <>
      {[ChannelCategory.channel, ChannelCategory.priv].includes(currentChannelCategory) && (
        <Box sx={{ display: { xs: 'none', sm: 'block' }, borderLeft: '1px solid #eeeeee', overflowY: 'auto', minWidth: `${usersWidth}px` }}>
          <List
            subheader={
              <ListSubheader component="div" sx={{ backgroundColor: usersTitleColor, marginBottom: '1rem' }}>
                {t('main.users.title')}
              </ListSubheader>
            }
            dense={true}
            sx={{
              backgroundColor: usersColor,
            }}
          >
            {users.map((user) => (
              <React.Fragment key={user.nick}>
                <ListItemButton
                  onClick={(event) => {
                    handleContextMenuUserClick(event, 'user', user.nick);
                  }}
                >
                  <ListItemAvatar>
                    <Avatar alt={user.nick} src={user.avatar} />
                  </ListItemAvatar>
                  <ListItemText primary={user.nick} sx={{ color: user.color ?? 'inherit' }} />
                </ListItemButton>
              </React.Fragment>
            ))}
          </List>
        </Box>
      )}
    </>
  );
};

export default Users;
