import { servers, type Server, type ConnectionType } from '@/network/irc/servers';
import { getServerParam, getPortParam, getTlsParam } from './queryParams';

interface ParsedServer {
  host: string;
  port: number | undefined;
  tls: boolean | undefined;
  connectionType: ConnectionType | undefined;
}

const parseServerParam = (serverParam: string): ParsedServer => {
  let host = serverParam;
  let tls: boolean | undefined;
  let connectionType: ConnectionType | undefined;

  // Check for protocol prefix
  if (host.startsWith('ircs://')) {
    host = host.slice(7);
    tls = true;
    connectionType = 'backend';
  } else if (host.startsWith('irc://')) {
    host = host.slice(6);
    tls = false;
    connectionType = 'backend';
  } else if (host.startsWith('wss://')) {
    host = host.slice(6);
    tls = true;
    connectionType = 'websocket';
  } else if (host.startsWith('ws://')) {
    host = host.slice(5);
    tls = false;
    connectionType = 'websocket';
  }

  // Remove trailing slash if present
  if (host.endsWith('/')) {
    host = host.slice(0, -1);
  }

  // Check for server:port format
  const lastColonIndex = host.lastIndexOf(':');
  if (lastColonIndex > 0) {
    const possiblePort = host.slice(lastColonIndex + 1);
    const port = parseInt(possiblePort, 10);
    if (!isNaN(port) && port > 0 && port <= 65535) {
      return { host: host.slice(0, lastColonIndex), port, tls, connectionType };
    }
  }

  return { host, port: undefined, tls, connectionType };
};

export const resolveServerFromParams = (): Server | undefined => {
  const serverParam = getServerParam();
  if (!serverParam) {
    return undefined;
  }

  const { host, port: embeddedPort, tls: embeddedTls, connectionType: embeddedConnectionType } = parseServerParam(serverParam);
  const portParam = getPortParam() ?? embeddedPort;
  const tlsParam = getTlsParam() ?? embeddedTls;
  const connectionType = embeddedConnectionType ?? 'backend';

  const matched = servers.find((s) => s.network.toLowerCase() === host.toLowerCase());

  if (matched) {
    // Use matched server, but allow overriding TLS if specified
    return tlsParam !== undefined ? { ...matched, tls: tlsParam } : matched;
  }

  // Custom server
  const serverAddress = portParam ? `${host}:${portParam}` : host;

  if (connectionType === 'websocket') {
    const protocol = tlsParam ? 'wss' : 'ws';
    const portSuffix = portParam ? `:${portParam}` : '';
    return {
      connectionType,
      default: 0,
      encoding: 'utf8',
      network: host,
      servers: [serverAddress],
      tls: tlsParam ?? true,
      websocketUrl: `${protocol}://${host}${portSuffix}/`,
    };
  }

  return {
    connectionType,
    default: 0,
    encoding: 'utf8',
    network: host,
    servers: [serverAddress],
    tls: tlsParam ?? false,
  };
};
