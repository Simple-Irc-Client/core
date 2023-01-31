import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../store/settings";

const CreatorNick = () => {
  const { t } = useTranslation();
  const [formNick, setFormNick] = useState("");

  const setNick = useSettingsStore((state) => state.setNick);
  const setCreatorStep = useSettingsStore((state) => state.setCreatorStep);

  const onClick = () => {
    if (formNick.length !== 0) {
      setNick(formNick);
      setCreatorStep(2);
    }
  };

  return (
    <>
      <Typography component="h1" variant="h5">
        {t("creator.nick.title")}
      </Typography>
      <Box component="form" sx={{ mt: 1 }}>
        <TextField
          margin="normal"
          required
          fullWidth
          id="nick"
          label={t("creator.nick.nick")}
          name="nick"
          autoComplete="nick"
          autoFocus
          onChange={(event) => setFormNick(event.target.value)}
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
