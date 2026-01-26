import React, { type FC, type PropsWithChildren, useState, useMemo, useCallback } from 'react';
import { UsersDrawerContext } from './UsersDrawerContext';

export const UsersDrawerProvider: FC<PropsWithChildren> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleUsersDrawerStatus = useCallback((): void => {
    setIsOpen(!isOpen);
  }, [isOpen]);

  const value = useMemo(
    () => ({
      isUsersDrawerOpen: isOpen,
      setUsersDrawerStatus: handleUsersDrawerStatus,
    }),
    [handleUsersDrawerStatus, isOpen],
  );

  return <UsersDrawerContext.Provider value={value}>{children}</UsersDrawerContext.Provider>;
};
