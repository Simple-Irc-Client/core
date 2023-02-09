import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import TagOutlinedIcon from "@mui/icons-material/TagOutlined";
import { useSettingsStore } from "../store/settings";

const Channels = () => {
  const openChannels: string[] = useSettingsStore(
    (state) => state.openChannels
  );
  const setCurrentChannelName: Function = useSettingsStore(
    (state) => state.setCurrentChannelName
  );

  const handleListItemClick = (channel: string) => {
    setCurrentChannelName(channel);
  };

  return (
    <List>
      {openChannels.map((channel) => (
        <ListItemButton
          key={channel}
          dense={true}
          onClick={(event) => handleListItemClick(channel)}
        >
          <ListItemIcon sx={{ minWidth: 0 }}>
            <TagOutlinedIcon />
          </ListItemIcon>
          <ListItemText primary={channel} />
        </ListItemButton>
      ))}
    </List>
  );
};

export default Channels;
