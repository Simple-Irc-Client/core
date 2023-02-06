import { ChannelListStore } from "../store/channels";
import { SettingsStore } from "../store/settings";
import { parseIrcRawMessage } from "./helpers";
import { ircSendList } from "./network";

export type IrcEvent = {
  type: string;
  line?: string;
};

export const kernel = (
  settingsStore: SettingsStore,
  channelListStore: ChannelListStore,
  event: IrcEvent
) => {
  switch (event.type) {
    case "connected":
      handleConnected(settingsStore);
      break;
    case "raw":
      if (event?.line) {
        handleRaw(settingsStore, channelListStore, event.line);
      }
      break;
  }
};

const handleConnected = (settingsStore: SettingsStore) => {
  settingsStore.setIsConnected(true);
  settingsStore.setConnectedTime(Math.floor(Date.now() / 1000));
  ircSendList();
};

const handleRaw = (
  settingsStore: SettingsStore,
  channelListStore: ChannelListStore,
  event: string
) => {
  const { tags, sender, command, line } = parseIrcRawMessage(event);

  switch (command) {
    case "001":
      onRaw001(settingsStore);
    case "321":
      onRaw321(settingsStore, channelListStore);
    case "322":
      onRaw322(settingsStore, channelListStore, line);
    case "323":
      onRaw323(channelListStore);
    case "NOTICE":
      onNotice(settingsStore, tags, sender, command, line);
  }
  // TODO
  // insomnia.pirc.pl 432 * Merovingian :Nickname is unavailable: Being held for registered user\r\n
  // ERROR :Closing Link: [185.251.84.36] (Registration Timeout)\r\n
  // @msgid=OzlbgBf04QlrtVm1hk02Jq;time=2023-02-04T23:17:18.121Z :Merovingian NICK :Niezident17561\r\n
  // :legowisko.pirc.pl 761 dsfsdfdsfdsfsdfdsfdsf Merovingian Avatar * :https://www.gravatar.com/avatar/8fadd198f40929e83421dd81e36f5637.jpg
};

const onRaw001 = (settingsStore) => {
  //
};

// :insomnia.pirc.pl 321 dsfdsfdsfsdfdsfsdfaas Channel :Users  Name\r\n
const onRaw321 = (
  settingsStore: SettingsStore,
  channelListStore: ChannelListStore
) => {
  channelListStore.setClearList();
};

// :insomnia.pirc.pl 322 dsfdsfdsfsdfdsfsdfaas #Base 1 :[+nt] \r\n
const onRaw322 = (
  settingsStore: SettingsStore,
  channelListStore: ChannelListStore,
  line: string[]
) => {
  const nick = line.shift();

  const channel = line.shift();
  const users = Number(line.shift() ?? "0");
  const topic = line.join(" ")?.substring(1);

  const newChannel = { channel, users, topic };

  console.log(`adding channel: ${JSON.stringify(newChannel)}`);

  channelListStore.setAddChannel(newChannel);
};

// ::insomnia.pirc.pl 323 dsfdsfdsfsdfdsfsdfaas :End of /LIST\r\n
const onRaw323 = (channelListStore: ChannelListStore) => {
  channelListStore.setFinished(true);
};

// :netsplit.pirc.pl NOTICE * :*** No ident response; username prefixed with ~\r\n
// @draft/bot;msgid=hjeGCPN39ksrHai7Rs5gda;time=2023-02-04T22:48:46.472Z :NickServ!NickServ@serwisy.pirc.pl NOTICE ghfghfghfghfghfgh :Twój nick nie jest zarejestrowany. Aby dowiedzieć się, jak go zarejestrować i po co, zajrzyj na https://pirc.pl/serwisy/nickserv/\r\n"
const onNotice = (
  settingsStore: SettingsStore,
  tags: string,
  sender: string,
  command: string,
  line: string[]
) => {
  const passwordRequired =
    /^(This nickname is registered and protected|Ten nick jest zarejestrowany i chroniony).*/;

  const list =
    /.*You have to be connected for at least (\d+) seconds before being able to \/LIST, please ignore the fake output above.*/;

  const target = line.shift();

  let message = line.join(" ");
  if (message.at(0) === ":") {
    message = message.substring(1);
  }

  if (
    sender.startsWith("NickServ!NickServ@") &&
    target === settingsStore.nick &&
    passwordRequired.test(message)
  ) {
    settingsStore.setIsPasswordRequired(true);
  }

  if (target === settingsStore.nick && list.test(message)) {
    const seconds = list.exec(message)?.[1];
    if (seconds) {
      const currentTime = Math.floor(Date.now() / 1000);
      const remaining =
        Number(seconds) - (currentTime - settingsStore.connectedTime);
      console.log(`settings.connectedTime: ${settingsStore.connectedTime}`);
      console.log(`currentTime: ${currentTime}`);
      console.log(`remaining: ${remaining}`);
      setTimeout(() => {
        ircSendList();
      }, Number(remaining + 1) * 1000);
    }
  }
};

const onJoin = () => {
  // const rawMetadataCommand = ['METADATA', joinEvent.nick, 'GET', 'Avatar'];
};
