import { type FC, type PropsWithChildren, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { DrawersContext } from './DrawersContext';

export const DrawersProvider: FC<PropsWithChildren> = ({ children }) => {
  const [isChannelsOpen, setChannelsOpen] = useState(false);
  const [isUsersOpen, setUsersOpen] = useState(false);

  // Latest open-state, readable from the mount-once popstate handler below.
  const anyDrawerOpenRef = useRef(false);
  anyDrawerOpenRef.current = isChannelsOpen || isUsersOpen;

  // Clear browser history so the Android hardware back button / back-swipe
  // doesn't navigate to the website (simpleircclient.com). When a drawer is
  // open, back closes it first (expected mobile behavior); either way we
  // re-arm the history entry so navigation away is always intercepted.
  useEffect(() => {
    history.replaceState(null, '');
    history.pushState(null, '');

    const handlePopState = () => {
      if (anyDrawerOpenRef.current) {
        setChannelsOpen(false);
        setUsersOpen(false);
      }
      history.pushState(null, '');
    };

    globalThis.addEventListener('popstate', handlePopState);
    return () => {
      globalThis.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const toggleChannelsDrawer = useCallback((): void => {
    setChannelsOpen((prev) => !prev);
    setUsersOpen(false); // Close users drawer when toggling channels
  }, []);

  const toggleUsersDrawer = useCallback((): void => {
    setUsersOpen((prev) => !prev);
    setChannelsOpen(false); // Close channels drawer when toggling users
  }, []);

  const value = useMemo(
    () => ({
      isChannelsDrawerOpen: isChannelsOpen,
      isUsersDrawerOpen: isUsersOpen,
      toggleChannelsDrawer,
      toggleUsersDrawer,
    }),
    [isChannelsOpen, isUsersOpen, toggleChannelsDrawer, toggleUsersDrawer],
  );

  return <DrawersContext.Provider value={value}>{children}</DrawersContext.Provider>;
};
