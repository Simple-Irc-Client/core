import Channels from "./components/Channels";
import Main from "./components/Main";
import Toolbar from "./components/Toolbar";
import Topic from "./components/Topic";
import Users from "./components/Users";
import Creator from "./pages/creator/Creator";
import { useSettingsStore } from "./store/settings";
import { useEffect } from "react";

import "./i18n";

import { sicSocket } from "./network/network";
import { kernel } from "./network/kernel";

import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import { createTheme, ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

const theme = createTheme();

function App() {
  const settings = useSettingsStore();

  useEffect(() => {
    const onIrcEvent = (data: any) => {
      console.log(`irc event: ${JSON.stringify(data)}`);
      kernel(settings, data);
    };

    sicSocket.on("sic-irc-event", onIrcEvent);
    return () => {
      sicSocket.off("sic-irc-event", onIrcEvent);
    };
  }, [sicSocket, settings]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {!settings.isCreatorCompleted && <Creator />}
      {settings.isCreatorCompleted && (
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
