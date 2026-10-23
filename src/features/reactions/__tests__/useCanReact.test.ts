import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCanReact } from '../useCanReact';
import { markCapabilitiesAcknowledged, resetCapabilityState } from '@/network/irc/capabilities';
import { E2eeState, getSessionKey, useE2eeStore } from '@features/e2ee/store/e2ee';
import { useSettingsStore } from '@features/settings/store/settings';
import { type E2eeSession } from '@features/e2ee/store/e2ee';

describe('useCanReact', () => {
  beforeEach(() => {
    markCapabilitiesAcknowledged(['message-tags']);
    useSettingsStore.setState({ isConnected: true, clientTagDeny: [] });
    useE2eeStore.setState({ sessions: {} });
  });

  afterEach(() => {
    resetCapabilityState();
  });

  it('allows reactions on a connection with message-tags', () => {
    expect(renderHook(() => useCanReact('#sic')).result.current).toBe(true);
  });

  it('does not while disconnected', () => {
    useSettingsStore.setState({ isConnected: false });

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
    useSettingsStore.setState({ clientTagDeny: deny });

    expect(renderHook(() => useCanReact('#sic')).result.current).toBe(false);
  });

  it('does in a DM the server relays them in, and not once it is encrypted', () => {
    const { result, rerender } = renderHook(() => useCanReact('bob'));
    expect(result.current).toBe(true);

    useE2eeStore.setState({ sessions: { [getSessionKey('bob')]: { state: E2eeState.active } as E2eeSession } });
    rerender();

    expect(result.current).toBe(false);
  });
});
