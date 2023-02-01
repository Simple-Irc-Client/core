import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { servers } from "../../models/servers";
import { connect } from "../../services/network";
import { useSettingsStore } from "../../store/settings";

const CreatorServer = () => {
  const { t } = useTranslation();

  const nick = useSettingsStore((state) => state.nick);

  const server = useSettingsStore((state) => state.server);
  const setServer = useSettingsStore((state) => state.setServer);
  const setCreatorStep = useSettingsStore((state) => state.setCreatorStep);

  const onClick = () => {
    if (server !== undefined) {
      connect(server, nick);
    }
  };

  return (
    <>
      <Typography component="h1" variant="h5">
        {t("creator.server.title")}
      </Typography>
      <Box component="form" sx={{ mt: 3 }}>
        <Autocomplete
          disablePortal
          options={servers}
          sx={{ width: 300 }}
          getOptionLabel={(option) => option.network}
          renderInput={(params) => (
            <TextField {...params} label={t("creator.server.server")} />
          )}
          renderOption={(props, option) => (
            <Box component="li" {...props}>
              {option.network}
            </Box>
          )}
          onChange={(event, newValue) => {
            if (newValue) {
              setServer(newValue);
            }
          }}
        />
        <Button
          onClick={onClick}
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
        >
          {t("creator.server.button.next")}
        </Button>
      </Box>
    </>
  );
};

export default CreatorServer;
