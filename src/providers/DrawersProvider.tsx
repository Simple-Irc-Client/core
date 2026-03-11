import { type FC, type PropsWithChildren, useState, useMemo, useCallback, useEffect } from 'react';
import { DrawersContext } from './DrawersContext';

export const DrawersProvider: FC<PropsWithChildren> = ({ children }) => {
  const [isChannelsOpen, setChannelsOpen] = useState(false);
  const [isUsersOpen, setUsersOpen] = useState(false);

  // Clear browser history so swiping back doesn't navigate
  // to the website (simpleircclient.com)
  useEffect(() => {
    history.replaceState(null, '');
    history.pushState(null, '');

    const handlePopState = () => {
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
