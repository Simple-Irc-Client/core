import { type FC, type PropsWithChildren, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { DrawersContext } from './DrawersContext';

const isMobile = () => globalThis.matchMedia?.('(max-width: 1023px)').matches;

export const DrawersProvider: FC<PropsWithChildren> = ({ children }) => {
  const [isChannelsOpen, setChannelsOpen] = useState(false);
  const [isUsersOpen, setUsersOpen] = useState(false);
  const channelsRef = useRef(isChannelsOpen);
  const usersRef = useRef(isUsersOpen);

  useEffect(() => {
    channelsRef.current = isChannelsOpen;
    usersRef.current = isUsersOpen;
  }, [isChannelsOpen, isUsersOpen]);

  // Intercept browser back navigation to control drawers
  // instead of navigating away from the app
  useEffect(() => {
    const pushState = () => {
      history.pushState({ drawer: true }, '');
    };

    // Push an initial state so back doesn't leave the app
    pushState();

    const handlePopState = () => {
      if (channelsRef.current) {
        setChannelsOpen(false);
      } else if (usersRef.current) {
        setUsersOpen(false);
      } else if (isMobile()) {
        setChannelsOpen(true);
      }
      // Re-push so back continues to work
      pushState();
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
