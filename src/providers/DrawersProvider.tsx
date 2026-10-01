import { type FC, type PropsWithChildren, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { DrawersContext } from './DrawersContext';

export const DrawersProvider: FC<PropsWithChildren> = ({ children }) => {
  const [isChannelsOpen, setChannelsOpen] = useState(false);
  const [isUsersOpen, setUsersOpen] = useState(false);

  // Latest open-state, readable from the mount-once popstate handler below.
  const anyDrawerOpenRef = useRef(false);
  useEffect(() => {
    anyDrawerOpenRef.current = isChannelsOpen || isUsersOpen;
  }, [isChannelsOpen, isUsersOpen]);

  // Android back must not leave the app; with a drawer open it closes the drawer
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
