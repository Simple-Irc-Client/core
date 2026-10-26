import { describe, expect, it, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { create } from 'zustand';
import { activateNetwork } from '../networks';
import { activeSlice, updateActiveSlice, useActiveSlice, type NetworkSlices } from '../networkSlices';
import { resetNetworks, TEST_SERVER } from '@/test/networks';

interface CounterSlice {
  count: number;
}

interface CounterStore extends NetworkSlices<CounterSlice> {
  increment: () => void;
  keep: () => void;
}

const NO_COUNT: CounterSlice = { count: 0 };
const OTHER_SERVER = { ...TEST_SERVER, network: 'OtherNet' };

const useCounterStore = create<CounterStore>()((set) => ({
  byNetwork: {},
  emptySlice: NO_COUNT,
  increment: () => set((state) => updateActiveSlice(state, (slice) => ({ count: slice.count + 1 }))),
  keep: () => set((state) => updateActiveSlice(state, (slice) => slice)),
}));

describe('network slices', () => {
  beforeEach(() => {
    resetNetworks();
    useCounterStore.setState({ byNetwork: {} });
  });

  it('reads the empty slice for a network with no data', () => {
    activateNetwork(TEST_SERVER, 'alice');

    expect(activeSlice(useCounterStore.getState())).toBe(NO_COUNT);
  });

  it('changes only the active network\'s slice', () => {
    activateNetwork(TEST_SERVER, 'alice');
    useCounterStore.getState().increment();
    activateNetwork(OTHER_SERVER, 'alice');
    useCounterStore.getState().increment();
    useCounterStore.getState().increment();

    expect(useCounterStore.getState().byNetwork).toEqual({ TestNet: { count: 1 }, OtherNet: { count: 2 } });
  });

  it('leaves the store as it is when an update returns the slice itself', () => {
    activateNetwork(TEST_SERVER, 'alice');
    useCounterStore.getState().increment();
    const before = useCounterStore.getState().byNetwork;

    useCounterStore.getState().keep();

    expect(useCounterStore.getState().byNetwork).toBe(before);
  });

  it('keeps what is written before a network is chosen apart', () => {
    useCounterStore.getState().increment();
    activateNetwork(TEST_SERVER, 'alice');

    expect(activeSlice(useCounterStore.getState())).toBe(NO_COUNT);
  });

  it('re-renders with the slice of the network switched to', () => {
    activateNetwork(TEST_SERVER, 'alice');
    useCounterStore.getState().increment();
    const { result } = renderHook(() => useActiveSlice(useCounterStore, (slice) => slice.count));
    expect(result.current).toBe(1);

    act(() => activateNetwork(OTHER_SERVER, 'alice'));

    expect(result.current).toBe(0);
  });
});
