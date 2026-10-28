// Per network; ignored users' messages, notices, CTCPs, typing, reactions and invites are dropped

import { foldName } from '@shared/lib/caseMapping';
import { getIgnoreMasksForNetwork, useIgnoreStore } from './store/ignore';
import { findActiveNetworkId, getCaseMapping, getCurrentNick, isSameName } from '@features/networks/store/networks';

/** A bare nick, `nick!user` or `user@host` completed to a full `nick!user@host` mask; undefined when not a mask */
export const toIgnoreMask = (entry: string): string | undefined => {
  const text = entry.trim();
  if (text.length === 0 || /\s/.test(text)) {
    return undefined;
  }
  const at = text.indexOf('@');
  const prefix = at === -1 ? text : text.slice(0, at);
  const host = at === -1 ? '' : text.slice(at + 1);
  const bang = prefix.indexOf('!');
  const nick = bang !== -1 ? prefix.slice(0, bang) : at === -1 ? prefix : '';
  const user = bang !== -1 ? prefix.slice(bang + 1) : at === -1 ? '' : prefix;
  if (host.includes('@') || user.includes('!')) {
    return undefined;
  }
  return `${nick || '*'}!${user || '*'}@${host || '*'}`;
};

/** The mask the user menu ignores a nick with */
export const nickIgnoreMask = (nick: string): string => `${nick}!*@*`;

export const getIgnoreMasks = (): string[] => {
  const network = findActiveNetworkId();
  return network === undefined ? [] : getIgnoreMasksForNetwork(network);
};

/** False for an entry that is not a mask, or no configured network */
export const addIgnore = (entry: string): boolean => {
  const network = findActiveNetworkId();
  const mask = toIgnoreMask(entry);
  if (network === undefined || mask === undefined) {
    return false;
  }
  useIgnoreStore.getState().addMask(network, mask);
  return true;
};

/** False when the entry is not on the list */
export const removeIgnore = (entry: string): boolean => {
  const network = findActiveNetworkId();
  const mask = toIgnoreMask(entry);
  if (network === undefined || mask === undefined || !getIgnoreMasksForNetwork(network).some((existing) => isSameName(existing, mask))) {
    return false;
  }
  useIgnoreStore.getState().removeMask(network, mask);
  return true;
};

export const isIgnoredMask = (entry: string): boolean => {
  const mask = toIgnoreMask(entry);
  return mask !== undefined && getIgnoreMasks().some((existing) => isSameName(existing, mask));
};

const maskToRegExp = (mask: string): RegExp => {
  const pattern = [...mask].map((char) => {
    if (char === '*') {
      return '.*';
    }
    if (char === '?') {
      return '.';
    }
    return char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  });
  return new RegExp(`^${pattern.join('')}$`, 'su');
};

/** Whether a message's source (`nick!user@host`, with or without the leading colon) is ignored; servers and we never are */
export const isIgnoredSender = (sender: string): boolean => {
  const masks = getIgnoreMasks();
  const source = sender.startsWith(':') ? sender.slice(1) : sender;
  const bang = source.indexOf('!');
  if (masks.length === 0 || bang === -1 || isSameName(source.slice(0, bang), getCurrentNick())) {
    return false;
  }
  const mapping = getCaseMapping();
  const folded = foldName(source, mapping);
  return masks.some((mask) => maskToRegExp(foldName(mask, mapping)).test(folded));
};
