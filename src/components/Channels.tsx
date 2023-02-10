import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import TagOutlinedIcon from "@mui/icons-material/TagOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import { useSettingsStore } from "../store/settings";
import { ChannelCategory } from "../types";
import ListSubheader from "@mui/material/ListSubheader";
import { useTranslation } from "react-i18next";

const Channels = () => {
  const { t } = useTranslation();

  const openChannels: string[] = useSettingsStore(
    (state) => state.openChannels
  );
  const setCurrentChannelName: Function = useSettingsStore(
    (state) => state.setCurrentChannelName
  );
  const setCurrentChannelCategory: Function = useSettingsStore(
    (state) => state.setCurrentChannelCategory
  );

  const currentChannelCategory: ChannelCategory | undefined = useSettingsStore(
    (state) => state.currentChannelCategory
  );

  const handleListItemClick = (channel: string) => {
    setCurrentChannelName(channel);
    // TODO setCurrentChannelCategory();
  };

  return (
    <List
      subheader={
        <ListSubheader component="div">
          {t("main.channels.title")}
        </ListSubheader>
      }
      sx={{ minWidth: "200px" }}
    >
      {openChannels.map((channel) => (
        <ListItemButton
          key={channel}
          dense={true}
          onClick={() => handleListItemClick(channel)}
        >
          <ListItemIcon sx={{ minWidth: 0 }}>
            {currentChannelCategory === "channel" && <TagOutlinedIcon />}
            {currentChannelCategory === "priv" && <PersonOutlineOutlinedIcon />}
            {currentChannelCategory === "status" && <HomeOutlinedIcon />}
            {currentChannelCategory === "debug" && <BuildOutlinedIcon />}
            {currentChannelCategory === undefined && <TagOutlinedIcon />}
          </ListItemIcon>
          <ListItemText primary={channel} />
        </ListItemButton>
      ))}
    </List>
  );
};

export default Channels;
