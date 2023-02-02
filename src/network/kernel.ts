import { useSettingsStore } from "../store/settings";

export const kernel = (message: string) => {
  const { type, event } = JSON.parse(message);

  switch (type) {
    case "connected":
      handleConnected();
      break;
    case "raw":
      handleRaw(event);
      break;
  }
};

const handleConnected = () => {
  const setIsConnected = useSettingsStore((state) => state.setIsConnected);
  setIsConnected(true);
};

const handleRaw = (event: string) => {
  const line: string[] = event?.split(" ") ?? [];

  // @msgid=rPQvwimgWqGnqVcuVONIFJ;time=2023-02-01T23:08:26.026Z
  // @draft/bot;msgid=oZvJsXO82XJXWMsnlSFTD5;time=2023-02-01T22:54:54.532Z
  let tags = "";
  if (line.at(0)?.startsWith("@")) {
    tags = line.shift() ?? "";
  }

  const lineWithoutTags = line.join(" ");

  console.log(`lineWithoutTags: ${lineWithoutTags}`); // TODO debug
};
