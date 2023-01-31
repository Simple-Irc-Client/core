import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import { useSettingsStore } from "../../store/settings";
import CreatorChannelList from "./CreatorChannelList";
import CreatorNick from "./CreatorNick";
import CreatorPassword from "./CreatorPassword";
import CreatorServer from "./CreatorServer";

const Creator = () => {
  const creatorStep = useSettingsStore((state) => state.creatorStep);

  return (
    <Container maxWidth="sm">
      <Box
          sx={{
            marginTop: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
      {creatorStep === 1 && <CreatorNick />}
      {creatorStep === 2 && <CreatorServer />}
      {creatorStep === 3 && <CreatorPassword />}
      {creatorStep === 4 && <CreatorChannelList />}
      </Box>
    </Container>
  );
};

export default Creator;
