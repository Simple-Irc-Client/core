import { afterEach, describe, expect, it } from 'vitest';
import { isClientTagAllowed } from '../clientTags';
import { markCapabilitiesAcknowledged, resetCapabilityState } from '../capabilities';

describe('isClientTagAllowed', () => {
  afterEach(() => {
    resetCapabilityState();
  });

  it('allows every client tag when the server denies none', () => {
    markCapabilitiesAcknowledged(['message-tags']);

    expect(isClientTagAllowed('draft/react', [])).toBe(true);
  });

  it('denies the tags listed', () => {
    markCapabilitiesAcknowledged(['message-tags']);

    expect(isClientTagAllowed('draft/react', ['draft/react', 'typing'])).toBe(false);
    expect(isClientTagAllowed('draft/reply', ['draft/react', 'typing'])).toBe(true);
  });

  it('denies all but the exempted ones under *', () => {
    markCapabilitiesAcknowledged(['message-tags']);
    const deny = ['*', '-draft/typing', '-typing', '-draft/reply'];

    expect(isClientTagAllowed('draft/reply', deny)).toBe(true);
    expect(isClientTagAllowed('draft/react', deny)).toBe(false);
  });

  it('allows none without message-tags', () => {
    expect(isClientTagAllowed('draft/react', [])).toBe(false);
  });
});
