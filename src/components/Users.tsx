import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import { useUsersStore } from "../store/users";
import { useSettingsStore } from "../store/settings";
import { User } from "../types";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import Avatar from "@mui/material/Avatar";

const Users = () => {
  const getUsersFromChannel: Function = useUsersStore(
    (state) => state.getUsersFromChannel
  );
  const currentChannelName: string = useSettingsStore(
    (state) => state.currentChannelName
  );
  const users: User[] = getUsersFromChannel(currentChannelName);

  return (
    <List>
      {users.map((user, index) => (
        <ListItem key={user.nick} disablePadding>
          <ListItemAvatar>
            <Avatar alt={user.nick} src={user.avatarUrl} />
          </ListItemAvatar>
          <ListItemText primary={user.nick} />
        </ListItem>
      ))}
    </List>
  );
};

export default Users;
