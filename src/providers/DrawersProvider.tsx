import { type FC, type PropsWithChildren, useState, useMemo, useCallback } from 'react';
import { DrawersContext } from './DrawersContext';

export const DrawersProvider: FC<PropsWithChildren> = ({ children }) => {
  const [isChannelsOpen, setChannelsOpen] = useState(false);
  const [isUsersOpen, setUsersOpen] = useState(false);

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
