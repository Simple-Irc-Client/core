import { connect as socketIOConnect } from "socket.io-client";
import { defaultIRCPort, websocketHost, websocketPort } from "../config";
import { Server } from "../models/servers";

export const sicSocket = socketIOConnect(`${websocketHost}:${websocketPort}`, {
  transports: ["websocket"],
  path: "/SimpleIrcClient",
});

// const queueMessages: unknown[] = [];

export const connect = (currentServer: Server, nick: string) => {
  if (currentServer.servers === undefined) {
    return;
  }

  const firstServer = currentServer.servers[0];

  if (firstServer === undefined) {
    return;
  }

  let serverHost: string | undefined = firstServer;
  let serverPort: string | undefined = `${defaultIRCPort}`;

  if (firstServer.includes(":")) {
    [serverHost, serverPort] = firstServer.split(":");
  }

  const connectCommand = {
    type: "connect",
    event: {
      nick,
      server: {
        host: serverHost,
        port: Number(serverPort),
        encoding: currentServer?.encoding,
      },
    },
  };

  sicSocket.emit("sic-client-event", connectCommand);
};

export const sendMessage = (message: unknown) => {
  sicSocket.emit("sic-client-event", message);
};

// setInterval(function networkSendQueueMessages() {
//   const message = queueMessages.pop();
//   if (message === undefined) {
//     return;
//   }
//   sicSocket.emit("sic-client-event", message);
// }, 300);
