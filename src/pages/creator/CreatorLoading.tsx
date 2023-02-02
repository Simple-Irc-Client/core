import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { webSocketStatus } from "../../network/network";
import { useSettingsStore } from "../../store/settings";
import { connect } from "../../network/network";

const CreatorLoading = () => {
  const { t } = useTranslation();

  const [progress, setProgress] = useState(1);
  const [isConnectedToIRC, setIsConnectedToIRC] = useState(false);

  const nick = useSettingsStore((state) => state.nick);
  const server = useSettingsStore((state) => state.server);
  const setCreatorStep = useSettingsStore((state) => state.setCreatorStep);

  const isConnected = useSettingsStore((state) => state.isConnected);

  setInterval(function websocketStatusLoop() {
    switch (webSocketStatus()) {
      case WebSocket.CONNECTING:
        if (progress < 10) {
          setProgress(10);
        }
        break;
      case WebSocket.OPEN:
        if (progress < 30) {
          setProgress(30);
        }
        break;
      case WebSocket.CLOSING:
      case WebSocket.CLOSED:
        if (progress !== 0) {
          setProgress(0);
        }
        break;
    }
  }, 100);

  if (isConnected) {
    if (progress < 50) {
      setProgress(50);
    }
  }

  if (progress === 30) {
    if (server && !isConnectedToIRC) {
      connect(server, nick);
      setIsConnectedToIRC(true);
    }
  }

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
