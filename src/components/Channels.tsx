import {
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Badge,
} from "@mui/material";
import {
  TagOutlined as TagOutlinedIcon,
  HomeOutlined as HomeOutlinedIcon,
  BuildOutlined as BuildOutlinedIcon,
  PersonOutlineOutlined as PersonOutlineOutlinedIcon,
} from "@mui/icons-material";
import { useSettingsStore } from "../store/settings";
import { Channel } from "../types";
import { useTranslation } from "react-i18next";
import { useChannelsStore } from "../store/channels";

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
