import { writable } from "svelte/store";

export const lastMessageFromServer = writable("");

const socket = new WebSocket("ws://localhost:8667");
let socketIsOpen = 0;

socket.addEventListener("open", () => {
  console.log("websocket event open");
  socketIsOpen = 1;
});

socket.addEventListener("message", ({ data }) => {
  lastMessageFromServer.set(data.toString());
});

socket.addEventListener("close", () => {
  console.log("websocket event close");

  socketIsOpen = 0;
});

socket.addEventListener("error", () => {
  console.log("websocket event error");
});

export const sendMessage = (message: string): string => {
  if (socket.readyState === socketIsOpen) {
    socket.send(message);
    return `Sent to server ${message}`;
  } else {
    return "Message was not sent - the socket is closed";
  }
};
