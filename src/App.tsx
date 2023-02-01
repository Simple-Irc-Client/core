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

const theme = createTheme();

import "./services/network";

function App() {
  const isCreatorCompleted = useSettingsStore(
    (state) => state.isCreatorCompleted
  );

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {!isCreatorCompleted && <Creator />}
      {isCreatorCompleted && (
        <div className="flex flex-col">
          <Channels />
          <div className="flex-row">
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
