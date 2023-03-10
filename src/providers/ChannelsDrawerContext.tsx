import { createContext, useContext } from 'react';

export interface ChannelsDrawerContextProps {
  isChannelsDrawerOpen: boolean;
  setChannelsDrawerStatus: () => void;
}

export const ChannelsDrawerContext = createContext<ChannelsDrawerContextProps>({
  isChannelsDrawerOpen: true,
  setChannelsDrawerStatus: function (): void {
    throw new Error('Function not implemented.');
  },
});

export const useChannelsDrawer = (): ChannelsDrawerContextProps => {
  const context = useContext(ChannelsDrawerContext);

  if (context === null) {
    throw new Error(`"ChannelsDrawerProvider" must be present in the DOM tree`);
  }

  return context;
};
