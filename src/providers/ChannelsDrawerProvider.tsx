import React, { type FC, type PropsWithChildren, useState, useMemo, useCallback } from 'react';
import { ChannelsDrawerContext } from './ChannelsDrawerContext';

export const ChannelsDrawerProvider: FC<PropsWithChildren> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(true);

  const handleChannelsDrawerStatus = useCallback((): void => {
    setIsOpen(!isOpen);
  }, [isOpen]);

  const value = useMemo(
    () => ({
      isChannelsDrawerOpen: isOpen,
      setChannelsDrawerStatus: handleChannelsDrawerStatus,
    }),
    [isOpen]
  );

  return <ChannelsDrawerContext.Provider value={value}>{children}</ChannelsDrawerContext.Provider>;
};
