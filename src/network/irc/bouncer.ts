// https://codeberg.org/emersion/soju/src/branch/master/doc/ext/bouncer-networks.md

import { isCapabilityEnabled } from '@/network/irc/capabilities';
import { ircDisconnect, ircReconnect, ircSendRawMessage } from '@/network/irc/network';
import { getSaslState } from '@/network/irc/sasl';
import { getBoundBouncerNetworkId } from '@features/bouncer/store/bouncerNetworks';
import { activateNetwork, getCurrentNick, getIsConnected, getServer } from '@features/networks/store/networks';
import { switchToBouncerNetwork } from '@features/networks/networkLifecycle';

/** BIND went out on this connection: a FAIL BOUNCER before registration completes is its answer */
let bindSent = false;

/** Before CAP END: binds the connection to the network chosen on the bouncer, which needs the account logged in */
export const sendBouncerBind = (): void => {
  const networkId = getServer()?.bouncer?.networkId;
  if (bindSent || networkId === undefined || !isCapabilityEnabled('soju.im/bouncer-networks') || getSaslState() !== 'success') {
    return;
  }
  bindSent = true;
  ircSendRawMessage(`BOUNCER BIND ${networkId}`);
};

/** The bouncer's own connection, where the user picks a network: bouncer-networks without a bound network */
export const isBouncerControlConnection = (): boolean =>
  isCapabilityEnabled('soju.im/bouncer-networks') && getBoundBouncerNetworkId() === undefined;

/** FAIL BOUNCER: a refused BIND never completes registration; the bouncer's own connection lets the user choose again */
export const onBouncerFailed = (): void => {
  const server = getServer();
  if (!bindSent || getIsConnected() || server?.bouncer === undefined) {
    return;
  }
  ircDisconnect();
  activateNetwork({ ...server, bouncer: { ...server.bouncer, networkId: undefined } }, getCurrentNick());
  void ircReconnect({ announce: false });
};

/** Leaves this connection for a new one bound to `networkId`: a network is chosen at registration only */
export const connectToBouncerNetwork = (networkId: string): void => {
  const server = getServer();
  if (server?.bouncer === undefined) {
    return;
  }
  ircDisconnect();
  // The bouncer brings back the new network's channels as it binds
  switchToBouncerNetwork({ ...server, bouncer: { ...server.bouncer, networkId } });
  void ircReconnect({ announce: false });
};

export const clearBouncerBind = (): void => {
  bindSent = false;
};
