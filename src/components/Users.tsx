import List from "@mui/material/List";
import ListItemText from "@mui/material/ListItemText";
import { useUsersStore } from "../store/users";
import { useSettingsStore } from "../store/settings";
import { ChannelCategory, User } from "../types";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import Avatar from "@mui/material/Avatar";
import ListSubheader from "@mui/material/ListSubheader";
import ListItemButton from "@mui/material/ListItemButton";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";

const Users = () => {
  const { t } = useTranslation();

  const getUsersFromChannel = useUsersStore(
    (state) => state.getUsersFromChannel
  );
  const currentChannelName: string = useSettingsStore(
    (state) => state.currentChannelName
  );
  const currentChannelCategory: ChannelCategory = useSettingsStore(
    (state) => state.currentChannelCategory
  );

  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const newList = getUsersFromChannel(currentChannelName);
    console.log(`newList: ${JSON.stringify(newList)}`);
    setUsers(newList);
  }, [currentChannelName]);

  console.log(`users component users ${JSON.stringify(users)}`);
  console.log(
    `users component currentChannelCategory ${currentChannelCategory}`
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
          sx={{
            minWidth: "200px",
          }}
        >
          {users.map((user) => (
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
