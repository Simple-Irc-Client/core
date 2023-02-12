import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import TagOutlinedIcon from "@mui/icons-material/TagOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import { useSettingsStore } from "../store/settings";
import { Channel } from "../types";
import ListSubheader from "@mui/material/ListSubheader";
import { useTranslation } from "react-i18next";
import { useChannelsStore } from "../store/channels";
import Badge from "@mui/material/Badge";

const Channels = () => {
  const { t } = useTranslation();

  const openChannels: Channel[] = useChannelsStore(
    (state) => state.openChannels
  );
  const setCurrentChannelName = useSettingsStore(
    (state) => state.setCurrentChannelName
  );

  const handleListItemClick = (channel: Channel) => {
    setCurrentChannelName(channel.name, channel.category);
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
          key={channel.name}
          aria-label={channel.name}
          dense={true}
          onClick={() => handleListItemClick(channel)}
        >
          <Badge
            badgeContent={channel.unReadMessages}
            showZero={false}
            max={99}
            color="primary"
            sx={{ top: "50%" }}
          >
            <ListItemIcon sx={{ minWidth: "30px" }}>
              {channel.category === "channel" && <TagOutlinedIcon />}
              {channel.category === "priv" && <PersonOutlineOutlinedIcon />}
              {channel.category === "status" && <HomeOutlinedIcon />}
              {channel.category === "debug" && <BuildOutlinedIcon />}
              {channel.category === undefined && <TagOutlinedIcon />}
            </ListItemIcon>
            <ListItemText primary={channel.name} />
          </Badge>
        </ListItemButton>
      ))}
    </List>
  );
};

export default Channels;
