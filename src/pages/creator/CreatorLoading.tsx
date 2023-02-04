import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { connect } from "../../network/network";
import { useSettingsStore } from "../../store/settings";

const CreatorLoading = () => {
  const { t } = useTranslation();

  const [progress, setProgress] = useState(1);

  const nick = useSettingsStore((state) => state.nick);
  const server = useSettingsStore((state) => state.server);
  const isConnecting = useSettingsStore((state) => state.isConnecting);
  const setIsConnecting = useSettingsStore((state) => state.setIsConnecting);
  const isConnected = useSettingsStore((state) => state.isConnected);
  const setCreatorStep = useSettingsStore((state) => state.setCreatorStep);

  if (server && !isConnecting && !isConnected) {
    setIsConnecting(true);
    console.log(`sending connect to irc command`);
    connect(server, nick);
  }

  useEffect(() => {
    if (isConnecting) {
      setProgress(30);
    }
  }, [isConnecting]);

  useEffect(() => {
    if (isConnected) {
      setProgress(50);
    }
  }, [isConnected]);

  return (
    <>
      <Box sx={{ width: "100%", mt: 3 }}>
        <LinearProgress variant="determinate" value={progress} />
        <h2></h2>
      </Box>
    </>
  );
};

export default CreatorLoading;
