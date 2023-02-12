import TextField from "@mui/material/TextField";
import { useEffect, useState } from "react";
import { useChannelsStore } from "../store/channels";
import { useSettingsStore } from "../store/settings";

const Topic = () => {
  const currentChannelName: string = useSettingsStore(
    (state) => state.currentChannelName
  );

  const [topic, setTopic] = useState<string>("");

  const getTopic = useChannelsStore((state) => state.getTopic);

  useEffect(() => {
    setTopic(getTopic(currentChannelName));
  }, [currentChannelName]);

  return (
    <TextField
      label={topic}
      InputProps={{
        readOnly: true,
      }}
    />
  );
};

export default Topic;
