import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import { useSettingsStore } from "../../store/settings";
import CreatorChannelList from "./CreatorChannelList";
import CreatorNick from "./CreatorNick";
import CreatorPassword from "./CreatorPassword";
import CreatorServer from "./CreatorServer";
import CreatorLoading from "./CreatorLoading";

const Creator = () => {
  const creatorStep = useSettingsStore((state) => state.creatorStep);

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          marginTop: 20,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {creatorStep === "nick" && <CreatorNick />}
        {creatorStep === "server" && <CreatorServer />}
        {creatorStep === "password" && <CreatorPassword />}
        {creatorStep === "loading" && <CreatorLoading />}
        {creatorStep === "channels" && <CreatorChannelList />}
      </Box>
    </Container>
  );
};

export default Creator;
