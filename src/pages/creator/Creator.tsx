import { useSettingsStore } from "../../store/settings";
import CreatorChannelList from "./CreatorChannelList";
import CreatorNick from "./CreatorNick";
import CreatorPassword from "./CreatorPassword";
import CreatorServer from "./CreatorServer";

const Creator = () => {
  const creatorStep = useSettingsStore((state) => state.creatorStep);

  return (
    <>
      {creatorStep === 1 && <CreatorNick />}
      {creatorStep === 2 && <CreatorServer />}
      {creatorStep === 3 && <CreatorPassword />}
      {creatorStep === 4 && <CreatorChannelList />}
    </>
  );
};

export default Creator;
