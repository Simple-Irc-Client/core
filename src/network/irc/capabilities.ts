// https://ircv3.net/specs/extensions/capability-negotiation.html

export interface CapabilityState {
  available: Map<string, string>;
  requested: Set<string>;
  acknowledged: Set<string>;
  negotiating: boolean;
  /** Multiline CAP LS */
  awaitingMoreCaps: boolean;
}

/** In priority order */
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
  'draft/metadata-2',
  'draft/metadata',
  'draft/metadata-notify-2',

  // Monitor (draft)
  'draft/extended-monitor',
];

export const createCapabilityState = (): CapabilityState => ({
  available: new Map(),
  requested: new Set(),
  acknowledged: new Set(),
  negotiating: false,
  awaitingMoreCaps: false,
});

let capabilityState = createCapabilityState();

export const getCapabilityState = (): CapabilityState => capabilityState;

export const resetCapabilityState = (): void => {
  capabilityState = createCapabilityState();
};

export const startCapNegotiation = (): void => {
  capabilityState.negotiating = true;
  capabilityState.awaitingMoreCaps = false;
};

export const setAwaitingMoreCaps = (awaiting: boolean): void => {
  capabilityState.awaitingMoreCaps = awaiting;
};

export const addAvailableCapabilities = (caps: Record<string, string>): void => {
  for (const [key, value] of Object.entries(caps)) {
    capabilityState.available.set(key, value);
  }
};

export const markCapabilitiesRequested = (caps: string[]): void => {
  for (const cap of caps) {
    capabilityState.requested.add(cap);
  }
};

export const markCapabilitiesAcknowledged = (caps: string[]): void => {
  for (const cap of caps) {
    capabilityState.acknowledged.add(cap);
  }
};

/** CAP DEL */
export const removeCapabilities = (caps: string[]): void => {
  for (const cap of caps) {
    capabilityState.available.delete(cap);
    capabilityState.acknowledged.delete(cap);
  }
};

export const endCapNegotiation = (): void => {
  capabilityState.negotiating = false;
  capabilityState.awaitingMoreCaps = false;
};

export const isCapabilityAvailable = (cap: string): boolean => {
  return capabilityState.available.has(cap);
};

export const isCapabilityEnabled = (cap: string): boolean => {
  return capabilityState.acknowledged.has(cap);
};

/** e.g. sasl=PLAIN,EXTERNAL */
export const getCapabilityValue = (cap: string): string | undefined => {
  return capabilityState.available.get(cap);
};

export const getCapabilitiesToRequest = (): string[] => {
  const toRequest: string[] = [];

  for (const cap of DESIRED_CAPABILITIES) {
    if (capabilityState.available.has(cap) && !capabilityState.acknowledged.has(cap)) {
      toRequest.push(cap);
    }
  }

  return toRequest;
};

/** "cap1 cap2=value cap3=value1,value2" */
export const parseCapabilityList = (capString: string): Record<string, string> => {
  const caps: Record<string, string> = {};

  const cleanString = capString.startsWith(':') ? capString.substring(1) : capString;
  const capList = cleanString.split(' ');

  for (const cap of capList) {
    if (cap.length === 0) { continue; }

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

export const parseSaslMechanisms = (value: string): string[] => {
  if (!value) return ['PLAIN']; // Default to PLAIN if no mechanisms specified
  return value.split(',').filter((m) => m.length > 0);
};
