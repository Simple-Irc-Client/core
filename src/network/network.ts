import { defaultIRCPort, websocketHost, websocketPort } from "../config";
import { Server } from "../models/servers";

import { create } from "zustand";

interface Network {
  websocket?: WebSocket;
  webSocketReady: boolean;
  queueMessages: string[];
  init: Function;
  setWebSocketReady: Function;
  sendMessage: Function;
  connect: Function;
  sendMessageQueue: Function;
}

export const useNetwork = create<Network>((set, get) => ({
  websocket: undefined,
  webSocketReady: false,
  queueMessages: [],

  init: () => {
    if (get().websocket === undefined) {
      set({
        websocket: new WebSocket(`ws://${websocketHost}:${websocketPort}`),
      });
    }
  },

  setWebSocketReady: (status: boolean) => {
    set({ webSocketReady: status });
  },

  sendMessage: (message: string) => {
    if (get().websocket?.readyState === WebSocket.OPEN) {
      get()?.websocket?.send(message);
      console.log(`Sent to server ${message}`);
    } else {
      console.log("Message was not sent - the socket is closed");
    }
  },

  connect: (currentServer: Server, nick: string) => {
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

    get().sendMessage(JSON.stringify(connectCommand));
  },

  sendMessageQueue: (message: string) => {
    set((state) => ({
      queueMessages: [...state.queueMessages, message],
    }));
  },
}));

// setInterval(function networkQueue() {
//   const message = queueMessages.pop();
//   if (message === undefined) {
//     return;
//   }
//   webSocket.send(message);
// }, 300);
