import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { connect } from "../../network/io";
import { useNetwork } from "../../network/network";
import { useSettingsStore } from "../../store/settings";

const CreatorLoading = () => {
  const { t } = useTranslation();

  const [progress, setProgress] = useState(1);
  const [isConnectedToIRC, setIsConnectedToIRC] = useState(false);

  const nick = useSettingsStore((state) => state.nick);
  const server = useSettingsStore((state) => state.server);

  if (server && !isConnectedToIRC) {
    setIsConnectedToIRC(true);
    connect(server, nick);
  }

  // const isConnected = useSettingsStore((state) => state.isConnected);

  // const setCreatorStep = useSettingsStore((state) => state.setCreatorStep);
  // const webSocketReady = useNetwork((state) => state.webSocketReady);
  // const connect = useNetwork((state) => state.connect);

  // useEffect(() => {
  //   if (webSocketReady && progress < 30) {
  //     setProgress(30);
  //   }
  //   if (!webSocketReady) {
  //     setProgress(0);
  //   }
  // }, [webSocketReady]);

  // useEffect(() => {
  //   if (progress < 50) {
  //     setProgress(50);
  //   }
  // }, [isConnected]);

  // useEffect(() => {
  //   if (progress === 30) {
  //     if (server && !isConnectedToIRC) {
  //       connect(server, nick);
  //       setIsConnectedToIRC(true);
  //     }
  //   }
  // }, [progress]);

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
