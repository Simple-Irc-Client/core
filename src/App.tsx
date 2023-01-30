import Channels from "./components/Channels";
import Main from "./components/Main";
import Toolbar from "./components/Toolbar";
import Topic from "./components/Topic";
import Users from "./components/Users";
import Creator from "./pages/creator/Creator";
import { useSettingsStore } from "./store/settings";

import "./i18n";

function App() {
  const isCreatorCompleted = useSettingsStore(
    (state) => state.isCreatorCompleted
  );

  return (
    <>
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
    </>
  );
}

export default App;
