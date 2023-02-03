import { websocketHost, websocketPort } from "../config";

class WebSocketClient {
  static instance: WebSocketClient | null = null;
  socket: WebSocket | null = null;

  static getInstance() {
    if (!WebSocketClient.instance) {
      WebSocketClient.instance = new WebSocketClient();
    }
    return WebSocketClient.instance;
  }

  constructor() {
    this.socket = null;
  }

  init = () => {
    this.socket = new WebSocket(`ws://${websocketHost}:${websocketPort}`);
  };
}

export default WebSocketClient.getInstance();
