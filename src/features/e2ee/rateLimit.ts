/**
 * SIC-E2EE v1 — a bounded per-peer throttle for inbound handshake traffic.
 *
 * Two things need it, and both were unbounded:
 *
 *  - Inbound OFFERs. Each costs two EC key imports, a hash, and — once past the
 *    pin check — a P-256 keypair and a store update that re-renders every
 *    subscribed component.
 *  - RESET replies. We answer an unreadable frame with a NOTICE; without a
 *    ceiling, a peer sending junk has us emitting one per frame.
 *
 * Deliberately per-key only, with no global ceiling. A global budget would need
 * a second tier to stop a flood of strangers exhausting it and locking out the
 * peer you actually want to encrypt with — a throttle usable to *force*
 * plaintext is worse than none. Keying on the peer alone avoids that entirely:
 * a key that is not being flooded is never refused, so nobody can be starved by
 * someone else's traffic.
 *
 * The trade is that N attacker nicks cost N times as much. That is acceptable
 * here: IRC servers already rate-limit how fast a client can send, and N nicks
 * means N connections, which clone limits cap. This is hardening, not a hole.
 */

export interface Throttle {
  /** Whether the action is permitted now. Records it when it is. */
  allow: (key: string, now?: number) => boolean;
  clear: () => void;
  /** Tracked keys. Exposed so tests can assert the bound holds. */
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
      // Pruning first means "still present" is exactly "still in cooldown",
      // which keeps the check below a single lookup and bounds the table by
      // traffic rate rather than by however many peers have ever appeared.
      for (const [tracked, at] of lastAllowed) {
        if (now - at >= cooldownMs) {
          lastAllowed.delete(tracked);
        }
      }

      if (lastAllowed.has(key)) {
        return false;
      }

      if (lastAllowed.size >= maxKeys) {
        // Evict rather than refuse. A full table is itself a sign of a flood,
        // and refusing would let that flood block a peer who has done nothing.
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
