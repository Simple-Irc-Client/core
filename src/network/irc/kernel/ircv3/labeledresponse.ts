import { type IrcHandlers } from '@/network/irc/kernel/context';

// The kernel takes the label off every reply before dispatch; ACK is the reply to a command that has no other
// @label=L1 :server ACK
export const onAck = (): void => {
  // Nothing to show
};

export const handlers: IrcHandlers = {
  ACK: onAck,
};
