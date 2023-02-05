import { defaultIRCPort } from "../config";
import { Server } from "../models/servers";
import { SingleServer } from "../types";

export const parseServer = (
  currentServer?: Server
): SingleServer | undefined => {
  if (currentServer === undefined || currentServer?.servers === undefined) {
    return undefined;
  }

  const firstServer = currentServer.servers?.[0];

  if (firstServer === undefined) {
    return undefined;
  }

  let serverHost: string | undefined = firstServer;
  let serverPort: string | undefined = `${defaultIRCPort}`;

  if (firstServer.includes(":")) {
    [serverHost, serverPort] = firstServer?.split(":");
  }

  return { host: serverHost, port: Number(serverPort || `${defaultIRCPort}`) };
};
