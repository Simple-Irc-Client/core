import { afterEach, beforeEach, vi } from 'vitest';
import * as networkFile from '@/network/irc/network';

export const defaultUserModes = [
  { symbol: '!', flag: 'y' }, // LibraIRC
  { symbol: '~', flag: 'q' },
  { symbol: '&', flag: 'a' },
  { symbol: '@', flag: 'o' },
  { symbol: '%', flag: 'h' },
  { symbol: '+', flag: 'v' },
];

/** Registers the hooks every kernel test file needs; call inside the top-level describe. */
export const setupKernelTest = (): void => {
  beforeEach(() => {
    // handleConnected (on 001) starts a real 30s keepalive interval; stub it by
    // default so tests don't leak timers. Tests that assert on it re-spy.
    vi.spyOn(networkFile, 'startKeepalive').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
};
