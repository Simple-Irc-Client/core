import { connect as socketIOConnect } from "socket.io-client";
import { defaultIRCPort, websocketHost, websocketPort } from "../config";
import { Server } from "../models/servers";

export const sicSocket = socketIOConnect(`${websocketHost}:${websocketPort}`);

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

  console.log(`socketIO.emit: connect`);
  sicSocket.emit("sic-client-event", connectCommand);
};
