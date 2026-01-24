/**
 * IRCv3 Capability Negotiation
 * https://ircv3.net/specs/extensions/capability-negotiation.html
 */

export interface CapabilityState {
  /** Capabilities advertised by the server with their values */
  available: Map<string, string>;
  /** Capabilities we have requested */
  requested: Set<string>;
  /** Capabilities the server has acknowledged */
  acknowledged: Set<string>;
  /** Whether CAP negotiation is in progress */
  negotiating: boolean;
  /** Whether we're waiting for more CAP LS lines (multiline) */
  awaitingMoreCaps: boolean;
}

/** Capabilities we want to enable, in priority order */
export const DESIRED_CAPABILITIES = [
  // Core message features
  'message-tags',
  'server-time',
  'batch',
  'labeled-response',
  'echo-message',

  // User tracking
  'away-notify',
  'account-notify',
  'account-tag',
  'extended-join',
  'chghost',
  'setname',

  // User display
  'multi-prefix',
  'userhost-in-names',

  // Authentication
  'sasl',

  // Capability management
  'cap-notify',

  // History (draft)
  'draft/chathistory',

  // Metadata (draft)
  'draft/metadata',
  'draft/metadata-notify-2',

  // Monitor (draft)
  'draft/extended-monitor',
];

/** Create initial capability state */
export const createCapabilityState = (): CapabilityState => ({
  available: new Map(),
  requested: new Set(),
  acknowledged: new Set(),
  negotiating: false,
  awaitingMoreCaps: false,
});

// Global capability state
let capabilityState = createCapabilityState();

/** Get current capability state */
export const getCapabilityState = (): CapabilityState => capabilityState;

/** Reset capability state (on disconnect) */
export const resetCapabilityState = (): void => {
  capabilityState = createCapabilityState();
};

/** Start CAP negotiation */
export const startCapNegotiation = (): void => {
  capabilityState.negotiating = true;
  capabilityState.awaitingMoreCaps = false;
};

/** Set whether we're awaiting more CAP LS lines */
export const setAwaitingMoreCaps = (awaiting: boolean): void => {
  capabilityState.awaitingMoreCaps = awaiting;
};

/** Add available capabilities from server CAP LS response */
export const addAvailableCapabilities = (caps: Record<string, string>): void => {
  for (const [key, value] of Object.entries(caps)) {
    capabilityState.available.set(key, value);
  }
};

/** Mark capabilities as requested */
export const markCapabilitiesRequested = (caps: string[]): void => {
  for (const cap of caps) {
    capabilityState.requested.add(cap);
  }
};

/** Mark capabilities as acknowledged by server */
export const markCapabilitiesAcknowledged = (caps: string[]): void => {
  for (const cap of caps) {
    capabilityState.acknowledged.add(cap);
  }
};

/** Remove capabilities (CAP DEL) */
export const removeCapabilities = (caps: string[]): void => {
  for (const cap of caps) {
    capabilityState.available.delete(cap);
    capabilityState.acknowledged.delete(cap);
  }
};

/** End CAP negotiation */
export const endCapNegotiation = (): void => {
  capabilityState.negotiating = false;
  capabilityState.awaitingMoreCaps = false;
};

/** Check if a capability is available on the server */
export const isCapabilityAvailable = (cap: string): boolean => {
  return capabilityState.available.has(cap);
};

/** Check if a capability has been acknowledged */
export const isCapabilityEnabled = (cap: string): boolean => {
  return capabilityState.acknowledged.has(cap);
};

/** Get the value of an available capability (e.g., sasl=PLAIN,EXTERNAL) */
export const getCapabilityValue = (cap: string): string | undefined => {
  return capabilityState.available.get(cap);
};

/**
 * Get list of capabilities to request from server
 * Only requests capabilities that are both desired and available
 */
export const getCapabilitiesToRequest = (): string[] => {
  const toRequest: string[] = [];

  for (const cap of DESIRED_CAPABILITIES) {
    if (capabilityState.available.has(cap) && !capabilityState.acknowledged.has(cap)) {
      toRequest.push(cap);
    }
  }

  return toRequest;
};

/**
 * Parse CAP LS/LIST response into key-value pairs
 * Handles format like: "cap1 cap2=value cap3=value1,value2"
 */
export const parseCapabilityList = (capString: string): Record<string, string> => {
  const caps: Record<string, string> = {};

  // Remove leading colon if present
  const cleanString = capString.startsWith(':') ? capString.substring(1) : capString;
  const capList = cleanString.split(' ');

  for (const cap of capList) {
    if (cap.length === 0) continue;

    if (!cap.includes('=')) {
      caps[cap] = '';
    } else {
      const eqIndex = cap.indexOf('=');
      const key = cap.substring(0, eqIndex);
      const value = cap.substring(eqIndex + 1);
      caps[key] = value;
    }
  }

  return caps;
};

/**
 * Parse SASL mechanisms from capability value
 * e.g., "EXTERNAL,PLAIN" -> ["EXTERNAL", "PLAIN"]
 */
export const parseSaslMechanisms = (value: string): string[] => {
  if (!value) return ['PLAIN']; // Default to PLAIN if no mechanisms specified
  return value.split(',').filter((m) => m.length > 0);
};

/**
 * Check if we should use SASL authentication
 */
export const shouldUseSasl = (): boolean => {
  return isCapabilityEnabled('sasl');
};

/**
 * Get supported SASL mechanisms (returns available mechanisms we support)
 */
export const getSupportedSaslMechanisms = (): string[] => {
  const serverMechanisms = parseSaslMechanisms(getCapabilityValue('sasl') ?? '');
  // We support PLAIN and EXTERNAL
  const supportedByClient = ['PLAIN', 'EXTERNAL'];
  return serverMechanisms.filter((m) => supportedByClient.includes(m));
};
