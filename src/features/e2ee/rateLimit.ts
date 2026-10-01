/**
 * Per-peer only, no global ceiling: a global budget could be exhausted by strangers to force plaintext with
 * the peer you want. N attacker nicks cost N times as much, which server rate and clone limits cap.
 */

export interface Throttle {
  /** Records the action when allowed. */
  allow: (key: string, now?: number) => boolean;
  clear: () => void;
  /** For tests. */
  readonly size: number;
}

/**
 * @param cooldownMs minimum spacing between two allowed actions for one key
 * @param maxKeys    hard cap on tracked keys; the oldest is dropped to make room
 */
export const createThrottle = (cooldownMs: number, maxKeys = 256): Throttle => {
  const lastAllowed = new Map<string, number>();

  return {
    allow(key, now = Date.now()) {
      // Insertion order is chronological, so pruning stops at the first unexpired entry
      for (const [tracked, at] of lastAllowed) {
        if (now - at < cooldownMs) {
          break;
        }
        lastAllowed.delete(tracked);
      }

      if (lastAllowed.has(key)) {
        return false;
      }

      if (lastAllowed.size >= maxKeys) {
        // Evict rather than refuse, or a flood could block an innocent peer
        let oldestKey: string | undefined;
        let oldestAt = Number.POSITIVE_INFINITY;
        for (const [tracked, at] of lastAllowed) {
          if (at < oldestAt) {
            oldestAt = at;
            oldestKey = tracked;
          }
        }
        if (oldestKey !== undefined) {
          lastAllowed.delete(oldestKey);
        }
      }

      lastAllowed.set(key, now);

      return true;
    },

    clear() {
      lastAllowed.clear();
    },

    get size() {
      return lastAllowed.size;
    },
  };
};
