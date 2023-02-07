import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ircConnect } from "../../network/network";
import { useSettingsStore } from "../../store/settings";

const CreatorLoading = () => {
  const { t } = useTranslation();

  const [progress, setProgress] = useState({ value: 1, label: "" });

  const nick = useSettingsStore((state) => state.nick);
  const server = useSettingsStore((state) => state.server);
  const isConnecting = useSettingsStore((state) => state.isConnecting);
  const setIsConnecting = useSettingsStore((state) => state.setIsConnecting);
  const isConnected = useSettingsStore((state) => state.isConnected);
  const setCreatorStep = useSettingsStore((state) => state.setCreatorStep);

  if (server && !isConnecting && !isConnected) {
    setIsConnecting(true);
    console.log(`sending connect to irc command`);
    ircConnect(server, nick);
  }

  useEffect(() => {
    if (isConnecting) {
      setProgress({ value: 30, label: t("creator.loading.connecting") });
    }
  }, [isConnecting]);

  useEffect(() => {
    if (isConnected) {
      setProgress({ value: 50, label: t("creator.loading.connected") });

      setTimeout(() => {
        setProgress({
          value: 50,
          label: t("creator.loading.isPasswordRequired"),
        });
      }, 2_000); // 2 sec

      setTimeout(() => {
        const localSettings = useSettingsStore.getState();
        if (localSettings.isPasswordRequired) {
          // setProgress({
          //   value: 50,
          //   label: t("creator.loading.passwordIsRequired"),
          // });
          setCreatorStep("password");
        } else {
          // setProgress({
          //   value: 50,
          //   label: t("creator.loading.passwordIsNotRequired"),
          // });
          setCreatorStep("channels");
        }
      }, 5_000); // 5 sec
    }
  }, [isConnected]);

  return (
    <>
      <Box sx={{ width: "100%", mt: 3 }}>
        <LinearProgress variant="determinate" value={progress.value} />
        {progress.label && (
          <h2 className="tw-text-center tw-mt-4">{progress.label}</h2>
        )}
      </Box>
    </>
  );
};

export default CreatorLoading;
