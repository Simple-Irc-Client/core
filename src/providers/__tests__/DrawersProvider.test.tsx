import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { type PropsWithChildren } from 'react';
import { DrawersProvider } from '../DrawersProvider';
import { useDrawers } from '../DrawersContext';

const wrapper = ({ children }: PropsWithChildren) => <DrawersProvider>{children}</DrawersProvider>;

const renderDrawers = () => renderHook(() => useDrawers(), { wrapper });

const goBack = (): void => {
  act(() => {
    globalThis.dispatchEvent(new PopStateEvent('popstate'));
  });
};

describe('DrawersProvider', () => {
  it('should start with both drawers closed', () => {
    const { result } = renderDrawers();

    expect(result.current.isChannelsDrawerOpen).toBe(false);
    expect(result.current.isUsersDrawerOpen).toBe(false);
  });

  it('should open one drawer at a time', () => {
    const { result } = renderDrawers();

    act(() => result.current.toggleChannelsDrawer());
    expect(result.current.isChannelsDrawerOpen).toBe(true);

    act(() => result.current.toggleUsersDrawer());
    expect(result.current).toMatchObject({ isChannelsDrawerOpen: false, isUsersDrawerOpen: true });

    act(() => result.current.toggleUsersDrawer());
    expect(result.current).toMatchObject({ isChannelsDrawerOpen: false, isUsersDrawerOpen: false });
  });

  it('should close an open drawer on Back, and stay in the app', () => {
    const pushState = vi.spyOn(history, 'pushState');
    const { result } = renderDrawers();
    act(() => result.current.toggleUsersDrawer());
    pushState.mockClear();

    goBack();

    expect(result.current.isUsersDrawerOpen).toBe(false);
    expect(pushState).toHaveBeenCalledOnce();
  });

  it('should stay in the app on Back with no drawer open', () => {
    const pushState = vi.spyOn(history, 'pushState');
    renderDrawers();
    pushState.mockClear();

    goBack();

    expect(pushState).toHaveBeenCalledOnce();
  });

  it('should stop handling Back once unmounted', () => {
    const pushState = vi.spyOn(history, 'pushState');
    const { unmount } = renderDrawers();
    unmount();
    pushState.mockClear();

    goBack();

    expect(pushState).not.toHaveBeenCalled();
  });

  it('should refuse to be used without the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useDrawers())).toThrow('"DrawersProvider" must be present');
  });
});
