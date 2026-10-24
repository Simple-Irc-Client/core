import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSTSPolicy, hasValidSTSPolicy, setSTSPolicy, useSTSStore } from '../stsStore';
import type { STSPolicy } from '../../sts';

const policy = (fields: Partial<STSPolicy>): STSPolicy => ({ host: 'irc.example.org', port: 6697, duration: 3600, expiresAt: 0, ...fields });

describe('STS policies', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-10-25T12:00:00Z') });
    useSTSStore.getState().clearAllPolicies();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should keep a policy per host, whatever its case', () => {
    setSTSPolicy('IRC.Example.org', policy({ port: 7000 }));

    expect(getSTSPolicy('irc.example.ORG')?.port).toBe(7000);
    expect(getSTSPolicy('other.example.org')).toBeUndefined();
  });

  it('should replace a host\'s policy with a newer one', () => {
    setSTSPolicy('irc.example.org', policy({ port: 7000 }));
    setSTSPolicy('irc.example.org', policy({ port: 7001 }));

    expect(getSTSPolicy('irc.example.org')?.port).toBe(7001);
  });

  it('should hold a policy valid until it expires', () => {
    setSTSPolicy('irc.example.org', policy({ expiresAt: Date.now() + 1000 }));

    expect(hasValidSTSPolicy('irc.example.org')).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(hasValidSTSPolicy('irc.example.org')).toBe(false);
  });

  it('should hold a policy without an expiry valid', () => {
    setSTSPolicy('irc.example.org', policy({ expiresAt: 0 }));

    expect(hasValidSTSPolicy('irc.example.org')).toBe(true);
  });

  it('should have no valid policy for an unknown host, or after clearing', () => {
    setSTSPolicy('irc.example.org', policy({}));
    useSTSStore.getState().clearAllPolicies();

    expect(hasValidSTSPolicy('irc.example.org')).toBe(false);
    expect(hasValidSTSPolicy('never.seen')).toBe(false);
  });
});
