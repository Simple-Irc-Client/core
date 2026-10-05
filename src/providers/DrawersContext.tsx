import { createContext, useContext } from 'react';

export interface DrawersContextProps {
  isChannelsDrawerOpen: boolean;
  isUsersDrawerOpen: boolean;
  toggleChannelsDrawer: () => void;
  toggleUsersDrawer: () => void;
}

export const DrawersContext = createContext<DrawersContextProps | null>(null);

export const useDrawers = (): DrawersContextProps => {
  const context = useContext(DrawersContext);

  if (context === null) {
    throw new Error(`"DrawersProvider" must be present in the DOM tree`);
  }

  return context;
};

export const useChannelsDrawer = () => {
  const { isChannelsDrawerOpen, toggleChannelsDrawer } = useDrawers();
  return {
    isChannelsDrawerOpen,
    toggleChannelsDrawer,
  };
};

export const useUsersDrawer = () => {
  const { isUsersDrawerOpen, toggleUsersDrawer } = useDrawers();
  return {
    isUsersDrawerOpen,
    toggleUsersDrawer,
  };
};
