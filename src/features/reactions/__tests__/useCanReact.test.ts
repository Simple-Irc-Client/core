import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCanReact } from '../useCanReact';
import { markCapabilitiesAcknowledged, resetCapabilityState } from '@/network/irc/capabilities';
import { E2eeState, getSessionKey, useE2eeStore } from '@features/e2ee/store/e2ee';
import { type E2eeSession } from '@features/e2ee/store/e2ee';
import { setTestSession, setTestSlice } from '@/test/networks';

describe('useCanReact', () => {
  beforeEach(() => {
    markCapabilitiesAcknowledged(['message-tags']);
    setTestSession({ isConnected: true, clientTagDeny: [] });
    setTestSlice(useE2eeStore, { sessions: {} });
  });

  afterEach(() => {
    resetCapabilityState();
  });

  it('allows reactions on a connection with message-tags', () => {
    expect(renderHook(() => useCanReact('#sic')).result.current).toBe(true);
  });

  it('does not while disconnected', () => {
    setTestSession({ isConnected: false });

    expect(renderHook(() => useCanReact('#sic')).result.current).toBe(false);
  });

  it('does not without message-tags', () => {
    resetCapabilityState();

    expect(renderHook(() => useCanReact('#sic')).result.current).toBe(false);
  });

  it.each([
    [['draft/react']],
    [['draft/reply']],
    [['*', '-draft/reply']],
  ])('does not when the server drops the tags it needs (CLIENTTAGDENY=%s)', (deny) => {
    setTestSession({ clientTagDeny: deny });

    expect(renderHook(() => useCanReact('#sic')).result.current).toBe(false);
  });

  it('does in a DM the server relays them in, and not once it is encrypted', () => {
    const { result, rerender } = renderHook(() => useCanReact('bob'));
    expect(result.current).toBe(true);

    setTestSlice(useE2eeStore, { sessions: { [getSessionKey('bob')]: { state: E2eeState.active } as E2eeSession } });
    rerender();

    expect(result.current).toBe(false);
  });
});
