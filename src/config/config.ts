export const STATUS_CHANNEL = 'Status';
export const DEBUG_CHANNEL = 'Debug';

export const defaultQuitMessage = 'Simple Irc Client ( https://simpleircclient.com )';

// CTCP response configuration
export const clientVersion = 'Simple IRC Client';
export const clientSourceUrl = 'https://simpleircclient.com';

export const websocketPort = 8667;
export const websocketHost = 'localhost';
export const websocketPath = 'webirc';

// Gateway configuration (for web client connecting to public gateway)
// When gatewayHost is set, the client will connect to the gateway instead of localhost
// and encryption will be disabled (gateway doesn't use encryption)
export const gatewayHost = import.meta.env.VITE_GATEWAY_HOST || '';
export const gatewayPort = Number(import.meta.env.VITE_GATEWAY_PORT) || 8667;
export const gatewayPath = import.meta.env.VITE_GATEWAY_PATH || '/webirc';

// Check if we're in gateway mode (connecting to public gateway)
export const isGatewayMode = (): boolean => gatewayHost !== '';

// AES-256-GCM encryption key (must match backend)
// Encryption is disabled in gateway mode
export const encryptionKey = 'K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols=';

export const defaultIRCPort = 6667;

export const maxMessages = 300;

export const defaultChannelTypes = ['#', '&'];

export const defaultMaxPermission = -1;
