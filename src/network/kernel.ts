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

  // NickServ!NickServ@serwisy.pirc.pl
  let nick = "";
  if (line.at(0)?.startsWith(":")) {
    nick = line.shift() ?? "";
    if (nick.at(0) === ":") {
      nick = nick.substring(1);
    }
  }

  const command = line.shift() ?? "";

  switch (command) {
    case "NOTICE":
      onNotice(settings, tags, nick, command, line);
  }
  // TODO
  // insomnia.pirc.pl 432 * Merovingian :Nickname is unavailable: Being held for registered user\r\n
  // ERROR :Closing Link: [185.251.84.36] (Registration Timeout)\r\n
  // @msgid=OzlbgBf04QlrtVm1hk02Jq;time=2023-02-04T23:17:18.121Z :Merovingian NICK :Niezident17561\r\n
};

// :netsplit.pirc.pl NOTICE * :*** No ident response; username prefixed with ~\r\n
// @draft/bot;msgid=hjeGCPN39ksrHai7Rs5gda;time=2023-02-04T22:48:46.472Z :NickServ!NickServ@serwisy.pirc.pl NOTICE ghfghfghfghfghfgh :Twój nick nie jest zarejestrowany. Aby dowiedzieć się, jak go zarejestrować i po co, zajrzyj na https://pirc.pl/serwisy/nickserv/\r\n"
const onNotice = (
  settings: SettingsStore,
  tags: string,
  nick: string,
  command: string,
  line: string[]
) => {
  const passwordRequired =
    /^(This nickname is registered and protected|Ten nick jest zarejestrowany i chroniony).*/;

  const target = line.shift();

  let message = line.join(" ");
  if (message.at(0) === ":") {
    message = message.substring(1);
  }

  if (
    nick.startsWith("NickServ!NickServ@") &&
    target === settings.nick &&
    passwordRequired.test(message)
  ) {
    settings.setIsPasswordRequired(true);
  }
};
