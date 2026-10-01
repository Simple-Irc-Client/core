// https://ircv3.net/specs/extensions/sts

export interface STSPolicy {
  host: string; // Server hostname (normalized to lowercase)
  port: number; // TLS port to use
  duration: number; // Duration in seconds (0 = indefinite)
  expiresAt: number; // Unix timestamp when policy expires (0 = never)
  preload?: boolean; // Whether server is on preload list
}

export interface STSUpgradeRequest {
  host: string;
  port: number;
  reason: 'sts_upgrade';
}

export interface ParsedSTS {
  port: number;
  duration: number;
  preload: boolean;
}

/** e.g. `port=6697,duration=300,preload`; null if invalid. */
export const parseSTSValue = (value: string): ParsedSTS | null => {
  if (!value) { return null; }

  const params: Record<string, string> = {};
  for (const param of value.split(',')) {
    if (param.includes('=')) {
      const parts = param.split('=', 2);
      const key = parts[0];
      const val = parts[1] ?? '';
      if (key) {
        params[key] = val;
      }
    } else if (param) {
      // e.g. 'preload'
      params[param] = 'true';
    }
  }

  // Required by the spec
  if (!params.port || !params.duration) {
    return null;
  }

  const port = Number.parseInt(params.port, 10);
  const duration = Number.parseInt(params.duration, 10);

  if (Number.isNaN(port) || Number.isNaN(duration) || port <= 0 || duration < 0) {
    return null;
  }

  return {
    port,
    duration,
    preload: params.preload === 'true',
  };
};

export const createSTSPolicy = (host: string, parsed: ParsedSTS): STSPolicy => ({
  host: host.toLowerCase(),
  port: parsed.port,
  duration: parsed.duration,
  // duration=0 persists indefinitely
  expiresAt: parsed.duration === 0 ? 0 : Date.now() + parsed.duration * 1000,
  preload: parsed.preload,
});

// Session state, not persisted

let pendingSTSUpgrade: STSUpgradeRequest | null = null;

let currentConnectionHost: string | null = null;
let currentConnectionTLS = false;

let stsUpgradeRetries = 0;
const MAX_STS_RETRIES = 3;

export const setPendingSTSUpgrade = (upgrade: STSUpgradeRequest | null): void => {
  pendingSTSUpgrade = upgrade;
};

export const getPendingSTSUpgrade = (): STSUpgradeRequest | null => pendingSTSUpgrade;

export const clearPendingSTSUpgrade = (): void => {
  pendingSTSUpgrade = null;
};

export const setCurrentConnectionInfo = (host: string | null, tls: boolean): void => {
  currentConnectionHost = host?.toLowerCase() ?? null;
  currentConnectionTLS = tls;
};

export const isCurrentConnectionSecure = (): boolean => currentConnectionTLS;

export const getCurrentConnectionHost = (): string | null => currentConnectionHost;

export const incrementSTSRetries = (): void => {
  stsUpgradeRetries++;
};

export const resetSTSRetries = (): void => {
  stsUpgradeRetries = 0;
};

export const hasExhaustedSTSRetries = (): boolean => stsUpgradeRetries >= MAX_STS_RETRIES;

export const resetSTSSessionState = (): void => {
  // The pending upgrade is needed for the reconnect
  currentConnectionHost = null;
  currentConnectionTLS = false;
};
