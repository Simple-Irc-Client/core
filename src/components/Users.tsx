import { useUsersStore } from "../store/users";
import { useSettingsStore } from "../store/settings";
import { ChannelCategory } from "../types";
import {
  Avatar,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  ListSubheader,
} from "@mui/material";
import { useTranslation } from "react-i18next";

const Users = () => {
  const { t } = useTranslation();

  const usersStore = useUsersStore();

  const currentChannelName: string = useSettingsStore(
    (state) => state.currentChannelName
  );
  const currentChannelCategory: ChannelCategory = useSettingsStore(
    (state) => state.currentChannelCategory
  );

  return (
    <>
      {currentChannelCategory === ChannelCategory.channel && (
        <List
          subheader={
            <ListSubheader component="div">
              {t("main.users.title")}
            </ListSubheader>
          }
          dense={true}
          sx={{
            minWidth: "200px",
          }}
        >
          {usersStore.getUsersFromChannel(currentChannelName).map((user) => (
            <ListItemButton key={user.nick}>
              <ListItemAvatar>
                <Avatar alt={user.nick} src={user.avatarUrl} />
              </ListItemAvatar>
              <ListItemText primary={user.nick} />
            </ListItemButton>
          ))}
        </List>
      )}
    </>
  );
};

export default Users;
