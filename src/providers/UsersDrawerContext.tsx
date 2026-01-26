import { createContext, useContext } from 'react';

export interface UsersDrawerContextProps {
  isUsersDrawerOpen: boolean;
  setUsersDrawerStatus: () => void;
}

export const UsersDrawerContext = createContext<UsersDrawerContextProps>({
  isUsersDrawerOpen: true,
  setUsersDrawerStatus: function (): void {
    throw new Error('Function not implemented.');
  },
});

export const useUsersDrawer = (): UsersDrawerContextProps => {
  const context = useContext(UsersDrawerContext);

  if (context === null) {
    throw new Error(`"UsersDrawerProvider" must be present in the DOM tree`);
  }

  return context;
};
