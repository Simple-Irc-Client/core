import { connect as socketIOConnect } from "socket.io-client";
import { defaultIRCPort, websocketHost, websocketPort } from "../config";
import { Server } from "../models/servers";
import { parseServer } from "./helpers";

export const sicSocket = socketIOConnect(`${websocketHost}:${websocketPort}`, {
  transports: ["websocket"],
  path: "/SimpleIrcClient",
});

// const queueMessages: unknown[] = [];

export const connect = (currentServer: Server, nick: string) => {
  const singleServer = parseServer(currentServer);
  if (!singleServer || !singleServer?.host) {
    throw new Error(
      "Unable to connect to IRC network - server host is empty"
    );
  }

  const connectCommand = {
    type: "connect",
    event: {
      nick,
      server: {
        host: singleServer.host,
        port: singleServer.port,
        encoding: currentServer?.encoding,
      },
    },
  };

  sendMessage(connectCommand);
};

export const sendMessage = (message: unknown) => {
  sicSocket.emit("sic-client-event", message);
};

// setInterval(function networkSendQueueMessages() {
//   const message = queueMessages.pop();
//   if (message === undefined) {
//     return;
//   }
//   sicSocket.volatile.emit("sic-client-event", message);
// }, 300);
