import Channels from "./components/Channels";
import Main from "./components/Main";
import Toolbar from "./components/Toolbar";
import Topic from "./components/Topic";
import Users from "./components/Users";
import Creator from "./pages/creator/Creator";
import { useSettingsStore } from "./store/settings";

import "./i18n";

import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
// import Network from "./Network";
// import { useNetwork } from "./network/network";

const theme = createTheme();

import { sicSocket } from "./network/io";
import { useEffect, useState } from "react";

function App() {
  const isCreatorCompleted = useSettingsStore(
    (state) => state.isCreatorCompleted
  );

  // const [messages, setMessages] = useState([]);

  useEffect(() => {
    sicSocket.on("sic-irc-event", (data) => {
      console.log(`irc event: ${JSON.stringify(data)}`);
      // setMessages([...messages, data]);
    });
  }, [sicSocket]);

  // const websocketInit = useNetwork((state) => state.init);
  // websocketInit();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* <Network /> */}
      {!isCreatorCompleted && <Creator />}
      {isCreatorCompleted && (
        <div className="tw-flex tw-flex-col">
          <Channels />
          <div className="tw-flex-row">
            <Topic />
            <Main />
            <Toolbar />
          </div>
          <Users />
        </div>
      )}
    </ThemeProvider>
  );
}

export default App;
