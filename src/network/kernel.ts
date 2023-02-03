import { SettingsStore } from "../store/settings";

export type IrcEvent = {
  type: string;
  line?: string;
};

export const kernel = (settings: SettingsStore, event: IrcEvent) => {
  switch (event.type) {
    case "connected":
      handleConnected(settings);
      break;
    case "raw":
      if (event?.line) {
        handleRaw(settings, event.line);
      }
      break;
  }
};

const handleConnected = (settings: SettingsStore) => {
  settings.setIsConnected(true);
};

const handleRaw = (settings: SettingsStore, event: string) => {
  const line: string[] = event?.split(" ") ?? [];

  // @msgid=rPQvwimgWqGnqVcuVONIFJ;time=2023-02-01T23:08:26.026Z
  // @draft/bot;msgid=oZvJsXO82XJXWMsnlSFTD5;time=2023-02-01T22:54:54.532Z
  let tags = "";
  if (line.at(0)?.startsWith("@")) {
    tags = line.shift() ?? "";
  }

  const lineWithoutTags = line.join(" ");

  // console.log(`lineWithoutTags: ${lineWithoutTags}`); // TODO debug
};
