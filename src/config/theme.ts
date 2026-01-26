
export const channelsWidth = 201;
export const usersWidth = 250;

export const MessageColor = {
  serverFrom: 'var(--msg-server-from)',
  serverTo: 'var(--msg-server-to)',
  time: 'var(--msg-time)',
  default: 'var(--msg-default)',
  join: 'var(--msg-join)',
  part: 'var(--msg-part)',
  quit: 'var(--msg-quit)',
  kick: 'var(--msg-kick)',
  mode: 'var(--msg-mode)',
  notice: 'var(--msg-notice)',
  info: 'var(--msg-info)',
  me: 'var(--msg-me)',
  error: 'var(--msg-error)',
} as const;

export type MessageColor = (typeof MessageColor)[keyof typeof MessageColor];
