import React, { type FC, type PropsWithChildren, useRef, useState } from 'react';
import { ChannelListContext } from './ChannelListContext';
import { type ChannelList } from '../types';

export const ChannelListProvider: FC<PropsWithChildren> = ({ children }) => {
  const channelList = useRef<ChannelList[]>([]);
  const [isFinished, setIsFinished] = useState(false);

  const handleAdd = (channel: ChannelList): void => {
    if (channel.name !== '*') {
      channelList.current.push(channel);
    }
  };

  const handleClear = (): void => {
    channelList.current = [];
  };

  const handleSetFinished = (status: boolean): void => {
    if (status) {
      channelList.current = channelList.current.sort((a: ChannelList, b: ChannelList) => {
        const A = a.name.toLowerCase();
        const B = b.name.toLowerCase();
        return A < B ? -1 : A > B ? 1 : 0;
      });
    }
    setIsFinished(status);
  };

  const value = {
    channelList: channelList.current.length > 10 ? channelList.current : [],
    isFinished,
    add: handleAdd,
    clear: handleClear,
    setFinished: handleSetFinished,
  };

  return <ChannelListContext.Provider value={value}>{children}</ChannelListContext.Provider>;
};
