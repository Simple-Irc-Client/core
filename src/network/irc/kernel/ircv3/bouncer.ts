// https://codeberg.org/emersion/soju/src/branch/master/doc/ext/bouncer-networks.md

import { unescapeTagValue } from '@/network/irc/helpers';
import { type IrcContext, type IrcHandlers } from '@/network/irc/kernel/context';
import { removeBouncerNetwork, updateBouncerNetwork } from '@features/bouncer/store/bouncerNetworks';

/** `name=libera;state=connected;error`: tag-encoded, and a key without a value is an attribute removed */
export const parseNetworkAttributes = (text: string): Record<string, string | undefined> => {
  const attributes: Record<string, string | undefined> = {};
  for (const pair of text.split(';')) {
    if (pair === '') {
      continue;
    }
    const separator = pair.indexOf('=');
    if (separator === -1) {
      attributes[pair] = undefined;
    } else {
      attributes[pair.substring(0, separator)] = unescapeTagValue(pair.substring(separator + 1));
    }
  }
  return attributes;
};

// :soju.test BOUNCER NETWORK 1 name=libera;state=connected;host=irc.libera.chat
// :soju.test BOUNCER NETWORK 1 state=disconnected;error=connection\serror
// :soju.test BOUNCER NETWORK 2 *
export const onBouncer = (ctx: IrcContext): void => {
  // ADDNETWORK, CHANGENETWORK and DELNETWORK replies are followed by a NETWORK line with the change
  if (ctx.line.shift() !== 'NETWORK') {
    return;
  }

  const id = ctx.line.shift();
  const attributes = ctx.trailingOptional();

  if (id === undefined || attributes === undefined) {
    ctx.logParseError(onBouncer, 'network');
    return;
  }

  if (attributes === '*') {
    removeBouncerNetwork(id);
  } else {
    updateBouncerNetwork(id, parseNetworkAttributes(attributes));
  }
};

export const handlers: IrcHandlers = {
  BOUNCER: onBouncer,
};
