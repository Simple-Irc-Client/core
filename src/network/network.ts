import { defaultIRCPort, websocketHost, websocketPort } from "../config";
import { Server } from "../models/servers";
import { kernel } from "./kernel";

const webSocket = new WebSocket(`ws://${websocketHost}:${websocketPort}`);

const queueMessages: string[] = [];

webSocket.onopen = () => {
  console.log("websocket opened");
};

webSocket.onmessage = (event) => {
  console.log(`websocket message: ${event?.data}`);
  if (event?.data) {
    kernel(event.data);
  }
};

webSocket.onerror = (event) => {
  console.log("websocket error:");
  console.log(event);
};

webSocket.onclose = (event) => {
  console.log("websocket closed");
};

setInterval(function networkQueue() {
  const message = queueMessages.pop();
  if (message === undefined) {
    return;
  }
  webSocket.send(message);
}, 300);

export const webSocketStatus = () => {
  return webSocket.readyState;
}

const sendMessage = (message: string) => {
  if (webSocket.readyState === 1) {
    webSocket.send(message);
    console.log(`Sent to server ${message}`);
  } else {
    console.log("Message was not sent - the socket is closed");
  }
};

const sendMessageQueue = (message: string) => {
  queueMessages.push(message);
};

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

  sendMessage(JSON.stringify(connectCommand));
};
