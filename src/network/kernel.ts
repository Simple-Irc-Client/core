import { SettingsStore } from "../store/settings";
import { parseIrcRawMessage } from "./helpers";

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
  const { tags, sender, command, line } = parseIrcRawMessage(event);

  switch (command) {
    case "NOTICE":
      onNotice(settings, tags, sender, command, line);
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
  sender: string,
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
    sender.startsWith("NickServ!NickServ@") &&
    target === settings.nick &&
    passwordRequired.test(message)
  ) {
    settings.setIsPasswordRequired(true);
  }
};
