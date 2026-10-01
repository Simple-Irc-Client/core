export const STATUS_CHANNEL = 'Status';
export const DEBUG_CHANNEL = 'Debug';

export const defaultQuitMessage = 'Simple Irc Client ( https://simpleircclient.com )';

export const clientVersion = 'Simple IRC Client';
export const clientSourceUrl = 'https://simpleircclient.com';

export const localBackendPort = 8667;
export const localBackendHost = 'localhost';
export const localBackendPath = 'webirc';

// When set, connects to the public gateway instead of localhost, without transport encryption
export const gatewayHost = import.meta.env.VITE_GATEWAY_HOST || '';
export const gatewayPort = Number(import.meta.env.VITE_GATEWAY_PORT) || 8667;
export const gatewayPath = import.meta.env.VITE_GATEWAY_PATH || '/webirc';

export const isGatewayMode = (): boolean => gatewayHost !== '';

// AES-256-GCM, must match the backend; unused in gateway mode
export const encryptionKey = import.meta.env.VITE_ENCRYPTION_KEY || '';

export const defaultIRCPort = 6667;

export const maxMessages = 300;

export const defaultChannelTypes = ['#', '&'];

export const defaultMaxPermission = -1;
