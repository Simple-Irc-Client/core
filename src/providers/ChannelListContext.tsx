import { createContext, useContext } from 'react';
import { type ChannelList } from '../types';

export interface ChannelListContextProps {
  channelList: ChannelList[];
  isFinished: boolean;
  add: (channel: ChannelList) => void;
  clear: () => void;
  setFinished: (status: boolean) => void;
}

export const ChannelListContext = createContext<ChannelListContextProps>({
  channelList: [],
  isFinished: false,
  add: function (channel: ChannelList): void {
    throw new Error('Function not implemented.');
  },
  clear: function (): void {
    throw new Error('Function not implemented.');
  },
  setFinished: function (status: boolean): void {
    throw new Error('Function not implemented.');
  },
});

export const useChannelList = (): ChannelListContextProps => {
  const context = useContext(ChannelListContext);

  if (context === null) {
    throw new Error(`"ChannelListProvider" must be present in the DOM tree`);
  }

  return context;
};
