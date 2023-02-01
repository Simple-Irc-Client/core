import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../store/settings";

const CreatorLoading = () => {
  const { t } = useTranslation();

  const setCreatorStep = useSettingsStore((state) => state.setCreatorStep);

  return (
    <>
      <Box component="form" sx={{ mt: 3 }}>
        <CircularProgress />
      </Box>
    </>
  );
};

export default CreatorLoading;
