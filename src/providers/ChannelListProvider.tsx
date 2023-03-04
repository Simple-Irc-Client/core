import React, { type FC, type PropsWithChildren, useRef, useCallback, useMemo, useState } from 'react';
import { ChannelListContext } from './ChannelListContext';
import { type ChannelList } from '../types';

export const ChannelListProvider: FC<PropsWithChildren> = ({ children }) => {
  const channelList = useRef<ChannelList[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  const handleAdd = useCallback((channel: ChannelList) => {
    if (channel.name !== '*') {
      channelList.current.push(channel);
    }
  }, []);

  const handleClear = useCallback(() => {
    channelList.current = [];
  }, []);

  const handleSetFinished = useCallback((status: boolean) => {
    if (status) {
      channelList.current = channelList.current.sort((a: ChannelList, b: ChannelList) => {
        const A = a.name.toLowerCase();
        const B = b.name.toLowerCase();
        return A < B ? -1 : A > B ? 1 : 0;
      });
    }
    setIsFinished(status);
  }, []);

  const value = useMemo(
    () => ({
      channelList: channelList.current,
      isFinished,
      add: handleAdd,
      clear: handleClear,
      setFinished: handleSetFinished,
    }),
    [isFinished]
  );

  return <ChannelListContext.Provider value={value}>{children}</ChannelListContext.Provider>;
};
