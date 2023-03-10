import React, { type FC, type PropsWithChildren, useState, useMemo } from 'react';
import { ChannelsDrawerContext } from './ChannelsDrawerContext';

export const ChannelsDrawerProvider: FC<PropsWithChildren> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(true);

  const handleChannelsDrawerStatus = (): void => {
    setIsOpen(!isOpen);
  };

  const value = useMemo(
    () => ({
      isChannelsDrawerOpen: isOpen,
      setChannelsDrawerStatus: handleChannelsDrawerStatus,
    }),
    [isOpen]
  );

  return <ChannelsDrawerContext.Provider value={value}>{children}</ChannelsDrawerContext.Provider>;
};
