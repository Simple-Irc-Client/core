import React from "react";
import { Avatar, Box, List, ListItem, ListItemAvatar, ListItemText, Typography } from "@mui/material";
import { useChannelsStore } from "../store/channels";
import { useSettingsStore } from "../store/settings";
import { type Message } from "../types";
import { format } from "date-fns";

const MainViewClassic = ({ message }: { message: Message }): JSX.Element => (
  <ListItem>
    <ListItemText>
      {format(new Date(message.time), "HH:mm")}
      &nbsp; &lt;
      {message?.nick !== undefined ? (typeof message.nick === "string" ? message.nick : message.nick.nick) : ""}
      &gt; &nbsp;
      {message.message}
    </ListItemText>
  </ListItem>
);

const MainViewModern = ({ message }: { message: Message }): JSX.Element => (
  <ListItem alignItems="flex-start">
    <ListItemAvatar>
      <Avatar
        alt={message?.nick !== undefined ? (typeof message.nick === "string" ? message.nick : message.nick.nick) : ""}
        src={message?.nick !== undefined ? (typeof message.nick === "string" ? undefined : message.nick.avatarUrl) : undefined}
      >
        {message?.nick !== undefined ? (typeof message.nick === "string" ? message.nick.substring(0, 1) : message.nick.nick.substring(0, 1)) : ""}
      </Avatar>
    </ListItemAvatar>
    <ListItemText
      sx={{ display: "block" }}
      primary={
        <React.Fragment>
          <Typography component="div">
            <Typography sx={{ display: "inline", float: "left" }} component="div" variant="body2">
              {message?.nick !== undefined ? (typeof message.nick === "string" ? message.nick : message.nick.nick) : ""}
            </Typography>
            <Typography sx={{ display: "inline", float: "right" }} component="div" variant="body2">
            {format(new Date(message.time), "HH:mm")}
            </Typography>
          </Typography>
        </React.Fragment>
      }
      secondary={
        <React.Fragment>
          <Typography sx={{ display: "block" }} component="span" variant="body2" color="text.primary">
            {message.message}
          </Typography>
        </React.Fragment>
      }
    />
  </ListItem>
);

const Main = (): JSX.Element => {
  const currentChannelName: string = useSettingsStore((state) => state.currentChannelName);

  const channelsStore = useChannelsStore();

  return (
    <Box sx={{ height: "100%" }}>
      {channelsStore.getMessages(currentChannelName).map((message, index) => (
        <List key={`message-${index}`} dense={true} sx={{ paddingTop: "0", paddingBottom: "0" }}>
          <MainViewModern message={message} />
        </List>
      ))}
    </Box>
  );
};

export default Main;
