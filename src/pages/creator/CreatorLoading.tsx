import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { connect } from "../../network/network";
import { useSettingsStore } from "../../store/settings";

const CreatorLoading = () => {
  const { t } = useTranslation();

  const [progress, setProgress] = useState(1);
  const [isConnectedToIRC, setIsConnectedToIRC] = useState(false);

  const nick = useSettingsStore((state) => state.nick);
  const server = useSettingsStore((state) => state.server);
  const isConnected = useSettingsStore((state) => state.isConnected);
  const setCreatorStep = useSettingsStore((state) => state.setCreatorStep);

  if (server && !isConnectedToIRC) {
    setIsConnectedToIRC(true);
    setProgress(30);
    connect(server, nick);
  }

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
