import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { connect } from "../../network/network";
import { useSettingsStore } from "../../store/settings";

const CreatorLoading = () => {
  const { t } = useTranslation();

  const [progress, setProgress] = useState(1);
  const [progressLabel, setProgressLabel] = useState<string | null>("");

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
      setProgressLabel(t("creator.loading.connecting"));
    }
  }, [isConnecting]);

  useEffect(() => {
    if (isConnected) {
      setProgress(50);
      setProgressLabel(t("creator.loading.connected"));

      setTimeout(() => {
        setProgressLabel(t("creator.loading.isPasswordRequired"));
      }, 2_000); // 2 sec

      setTimeout(() => {
        const localSettings = useSettingsStore.getState();
        if (localSettings.isPasswordRequired) {
          setProgressLabel(t("creator.loading.passwordIsRequired"));
          setCreatorStep("password");
        } else {
          setProgressLabel(t("creator.loading.passwordIsNotRequired"));
          setCreatorStep("channels");
        }
      }, 5_000); // 5 sec
    }
  }, [isConnected]);

  return (
    <>
      <Box sx={{ width: "100%", mt: 3 }}>
        <LinearProgress variant="determinate" value={progress} />
        {progressLabel && (
          <h2 className="tw-text-center tw-mt-4">{progressLabel}</h2>
        )}
      </Box>
    </>
  );
};

export default CreatorLoading;
