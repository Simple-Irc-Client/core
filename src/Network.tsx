import { useEffect, useState } from "react";
import { kernel } from "./network/kernel";
import { useNetwork } from "./network/network";

const Network = () => {
  const websocket = useNetwork((state) => state.websocket);
  const setWebSocketReady = useNetwork((state) => state.setWebSocketReady);
  const websocketInit = useNetwork((state) => state.init);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (websocket) {
      websocket.onopen = (event) => {
        console.log("websocket.onopen");
        setWebSocketReady(true);
      };

      websocket.onmessage = function (event) {
        console.log("websocket.onmessage");
        if (event?.data) {
          setMessage(event.data);
        }
      };

      websocket.onclose = function (event) {
        console.log("websocket.onclose");
        setWebSocketReady(false);
        // setTimeout(() => {
        //   websocketInit();
        // }, 1000);
      };

      websocket.onerror = function (err) {
        console.log("websocket.onerror");
        console.log(
          "Socket encountered error: ",
          err?.message,
          "Closing socket"
        );
        setWebSocketReady(false);
        //websocket.close();
      };

      return () => {
        websocket.close();
      };
    }
  }, [websocket]);

  useEffect(() => {
    if (message) {
      kernel(message);
    }
  }, [message]);

  return <></>;
};

export default Network;
