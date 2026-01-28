/**
 * IRCv3 STS (Strict Transport Security)
 * https://ircv3.net/specs/extensions/sts
 *
 * When a server advertises the STS capability, clients should:
 * 1. Disconnect from the insecure connection
 * 2. Reconnect with TLS on the specified port
 * 3. Store the policy for future connections
 */

// ============================================================================
// Types
// ============================================================================

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

// ============================================================================
// STS Value Parsing
// ============================================================================

/**
 * Parse STS capability value
 * Format: port=6697,duration=300,preload
 *
 * @param value - The STS capability value string
 * @returns Parsed STS object or null if invalid
 */
export const parseSTSValue = (value: string): ParsedSTS | null => {
  if (!value) return null;

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
      // Boolean flags like 'preload'
      params[param] = 'true';
    }
  }

  // port and duration are required per spec
  if (!params.port || !params.duration) {
    return null;
  }

  const port = parseInt(params.port, 10);
  const duration = parseInt(params.duration, 10);

  if (isNaN(port) || isNaN(duration) || port <= 0 || duration < 0) {
    return null;
  }

  return {
    port,
    duration,
    preload: params.preload === 'true',
  };
};

/**
 * Create an STS policy from parsed values
 *
 * @param host - The server hostname
 * @param parsed - The parsed STS values
 * @returns An STS policy object
 */
export const createSTSPolicy = (host: string, parsed: ParsedSTS): STSPolicy => ({
  host: host.toLowerCase(),
  port: parsed.port,
  duration: parsed.duration,
  // duration=0 means persist indefinitely (expiresAt=0 signals this)
  expiresAt: parsed.duration === 0 ? 0 : Date.now() + parsed.duration * 1000,
  preload: parsed.preload,
});

// ============================================================================
// Session State (module-level, not persisted)
// ============================================================================

// Pending STS upgrade request
let pendingSTSUpgrade: STSUpgradeRequest | null = null;

// Current connection info for STS detection
let currentConnectionHost: string | null = null;
let currentConnectionTLS: boolean = false;

// STS upgrade retry tracking
let stsUpgradeRetries = 0;
const MAX_STS_RETRIES = 3;

/**
 * Set a pending STS upgrade request
 */
export const setPendingSTSUpgrade = (upgrade: STSUpgradeRequest | null): void => {
  pendingSTSUpgrade = upgrade;
};

/**
 * Get the pending STS upgrade request
 */
export const getPendingSTSUpgrade = (): STSUpgradeRequest | null => pendingSTSUpgrade;

/**
 * Clear the pending STS upgrade request
 */
export const clearPendingSTSUpgrade = (): void => {
  pendingSTSUpgrade = null;
};

/**
 * Set current connection info for STS detection
 */
export const setCurrentConnectionInfo = (host: string | null, tls: boolean): void => {
  currentConnectionHost = host?.toLowerCase() ?? null;
  currentConnectionTLS = tls;
};

/**
 * Check if current connection is secure (TLS)
 */
export const isCurrentConnectionSecure = (): boolean => currentConnectionTLS;

/**
 * Get current connection host
 */
export const getCurrentConnectionHost = (): string | null => currentConnectionHost;

/**
 * Increment STS upgrade retry counter
 */
export const incrementSTSRetries = (): void => {
  stsUpgradeRetries++;
};

/**
 * Reset STS upgrade retry counter
 */
export const resetSTSRetries = (): void => {
  stsUpgradeRetries = 0;
};

/**
 * Check if STS upgrade retries are exhausted
 */
export const hasExhaustedSTSRetries = (): boolean => stsUpgradeRetries >= MAX_STS_RETRIES;

/**
 * Reset all STS session state (call on disconnect)
 */
export const resetSTSSessionState = (): void => {
  // Don't clear pending upgrade - it's needed for reconnection
  currentConnectionHost = null;
  currentConnectionTLS = false;
};
