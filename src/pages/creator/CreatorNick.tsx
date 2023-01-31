import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../store/settings";

const CreatorNick = () => {
  const { t } = useTranslation();

  const nick = useSettingsStore((state) => state.nick);
  const setNick = useSettingsStore((state) => state.setNick);
  const setCreatorStep = useSettingsStore((state) => state.setCreatorStep);

  const onClick = () => {
    if (nick.length !== 0) {
      setCreatorStep(2);
    }
  };

  return (
    <>
      <Typography component="h1" variant="h5">
        {t("creator.nick.title")}
      </Typography>
      <Box component="form" sx={{ mt: 3 }}>
        <TextField
          required
          fullWidth
          label={t("creator.nick.nick")}
          autoComplete="nick"
          autoFocus
          onChange={(event) => setNick(event.target.value)}
          defaultValue={nick}
        />
        <Button
          onClick={onClick}
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
        >
          {t("creator.nick.button.next")}
        </Button>
      </Box>
    </>
  );
};

export default CreatorNick;
