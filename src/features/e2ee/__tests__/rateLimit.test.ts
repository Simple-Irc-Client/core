import { describe, it, expect } from 'vitest';

import { createThrottle } from '../rateLimit';

/** Fixed clock — every test drives time explicitly rather than waiting on it. */
const T0 = 1_000_000;

describe('e2ee throttle', () => {
  it('allows the first action and refuses the next within the cooldown', () => {
    const throttle = createThrottle(1000);

    expect(throttle.allow('bob', T0)).toBe(true);
    expect(throttle.allow('bob', T0)).toBe(false);
    expect(throttle.allow('bob', T0 + 999)).toBe(false);
  });

  it('allows again once the cooldown has passed', () => {
    const throttle = createThrottle(1000);

    expect(throttle.allow('bob', T0)).toBe(true);
    expect(throttle.allow('bob', T0 + 1000)).toBe(true);
  });

  it('does not let refused attempts extend the cooldown', () => {
    const throttle = createThrottle(1000);

    throttle.allow('bob', T0);
    // A persistent flooder must not be able to keep itself locked out forever,
    // nor reset its own clock to slip through early.
    expect(throttle.allow('bob', T0 + 500)).toBe(false);
    expect(throttle.allow('bob', T0 + 900)).toBe(false);
    expect(throttle.allow('bob', T0 + 1000)).toBe(true);
  });

  it('tracks keys independently', () => {
    const throttle = createThrottle(1000);

    expect(throttle.allow('bob', T0)).toBe(true);
    expect(throttle.allow('carol', T0)).toBe(true);
    expect(throttle.allow('bob', T0)).toBe(false);
  });

  it('never tracks more keys than the cap', () => {
    const throttle = createThrottle(60_000, 32);

    for (let index = 0; index < 5000; index++) {
      throttle.allow(`flooder-${index}`, T0);
    }

    expect(throttle.size).toBeLessThanOrEqual(32);
  });

  it('forgets keys once their cooldown lapses', () => {
    const throttle = createThrottle(1000);

    throttle.allow('bob', T0);
    expect(throttle.size).toBe(1);

    throttle.allow('carol', T0 + 60_000);

    expect(throttle.size).toBe(1);
  });

  it('still admits a new key when the table is full of flooders', () => {
    const throttle = createThrottle(60_000, 4);

    for (let index = 0; index < 100; index++) {
      throttle.allow(`flooder-${index}`, T0);
    }

    // This is what removes the need for any per-tier budget: a full table
    // evicts to make room instead of refusing, so somebody else's flood can
    // never block a peer who has done nothing.
    expect(throttle.allow('bob', T0)).toBe(true);
  });

  it('clears everything', () => {
    const throttle = createThrottle(60_000);

    throttle.allow('bob', T0);
    expect(throttle.allow('bob', T0)).toBe(false);

    throttle.clear();

    expect(throttle.size).toBe(0);
    expect(throttle.allow('bob', T0)).toBe(true);
  });
});
