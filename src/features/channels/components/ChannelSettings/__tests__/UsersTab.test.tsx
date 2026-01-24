import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import UsersTab from '../tabs/UsersTab';
import * as network from '@/network/irc/network';
import * as usersStore from '@features/users/store/users';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/network/irc/network', () => ({
  ircSendRawMessage: vi.fn(),
}));

vi.mock('@shared/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

const mockUsers = [
  {
    nick: 'Owner',
    channels: [{ name: '#test', flags: ['q'] }],
  },
  {
    nick: 'Operator',
    channels: [{ name: '#test', flags: ['o'] }],
  },
  {
    nick: 'RegularUser',
    channels: [{ name: '#test', flags: [] }],
  },
  {
    nick: 'testuser',
    channels: [{ name: '#test', flags: ['o'] }],
  },
];

vi.mock('@features/settings/store/settings', () => ({
  useSettingsStore: vi.fn((selector) =>
    selector({
      userModes: [
        { symbol: '~', flag: 'q' },
        { symbol: '&', flag: 'a' },
        { symbol: '@', flag: 'o' },
        { symbol: '%', flag: 'h' },
        { symbol: '+', flag: 'v' },
      ],
      nick: 'testuser',
    })
  ),
}));

describe('UsersTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(usersStore, 'getUsersFromChannelSortedByMode').mockReturnValue(mockUsers as any);
    vi.spyOn(usersStore, 'getCurrentUserChannelModes').mockReturnValue(['o']);
  });

  describe('rendering', () => {
    it('should render search input', () => {
      render(<UsersTab channelName="#test" />);

      expect(screen.getByTestId('user-search')).toBeInTheDocument();
    });

    it('should render table headers', () => {
      render(<UsersTab channelName="#test" />);

      expect(screen.getByText('channelSettings.users.user')).toBeInTheDocument();
      expect(screen.getByText('channelSettings.users.status')).toBeInTheDocument();
      expect(screen.getByText('channelSettings.users.actions')).toBeInTheDocument();
    });

    it('should render user list', () => {
      render(<UsersTab channelName="#test" />);

      expect(screen.getByText('Owner')).toBeInTheDocument();
      expect(screen.getByText('Operator')).toBeInTheDocument();
      expect(screen.getByText('RegularUser')).toBeInTheDocument();
    });

    it('should display mode labels for users with modes', () => {
      render(<UsersTab channelName="#test" />);

      expect(screen.getByText('channelSettings.users.owner')).toBeInTheDocument();
      expect(screen.getAllByText('channelSettings.users.operator')).toHaveLength(2);
    });

    it('should display none label for users without modes', () => {
      render(<UsersTab channelName="#test" />);

      expect(screen.getByText('channelSettings.users.none')).toBeInTheDocument();
    });

    it('should show current user indicator', () => {
      render(<UsersTab channelName="#test" />);

      expect(screen.getByText('(channelSettings.users.you)')).toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    it('should filter users by search query', () => {
      render(<UsersTab channelName="#test" />);

      const searchInput = screen.getByTestId('user-search');
      fireEvent.change(searchInput, { target: { value: 'Owner' } });

      expect(screen.getByText('Owner')).toBeInTheDocument();
      expect(screen.queryByText('Operator')).not.toBeInTheDocument();
      expect(screen.queryByText('RegularUser')).not.toBeInTheDocument();
    });

    it('should be case insensitive', () => {
      render(<UsersTab channelName="#test" />);

      const searchInput = screen.getByTestId('user-search');
      fireEvent.change(searchInput, { target: { value: 'owner' } });

      expect(screen.getByText('Owner')).toBeInTheDocument();
    });

    it('should show no users message when no results', () => {
      render(<UsersTab channelName="#test" />);

      const searchInput = screen.getByTestId('user-search');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByText('channelSettings.users.noUsers')).toBeInTheDocument();
    });
  });

  describe('permission checking', () => {
    it('should show actions button for users that can be modified', () => {
      render(<UsersTab channelName="#test" />);

      // As operator (level 3), can modify regular users
      expect(screen.getByTestId('user-actions-RegularUser')).toBeInTheDocument();
    });

    it('should not show actions button for current user', () => {
      render(<UsersTab channelName="#test" />);

      expect(screen.queryByTestId('user-actions-testuser')).not.toBeInTheDocument();
    });

    it('should not show actions button for users with higher level', () => {
      render(<UsersTab channelName="#test" />);

      // Owner has level 5, current user is operator level 3
      expect(screen.queryByTestId('user-actions-Owner')).not.toBeInTheDocument();
    });

    it('should not show actions button for users with equal level', () => {
      render(<UsersTab channelName="#test" />);

      // Operator has level 3, same as current user
      expect(screen.queryByTestId('user-actions-Operator')).not.toBeInTheDocument();
    });
  });

  describe('mode changes', () => {
    it('should send MODE +v command when giving voice', () => {
      render(<UsersTab channelName="#test" />);

      fireEvent.click(screen.getByTestId('user-actions-RegularUser'));
      fireEvent.click(screen.getByText('channelSettings.users.give channelSettings.users.voice'));

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test +v RegularUser');
    });

    it('should send MODE +h command when giving halfop', () => {
      render(<UsersTab channelName="#test" />);

      fireEvent.click(screen.getByTestId('user-actions-RegularUser'));
      fireEvent.click(screen.getByText('channelSettings.users.give channelSettings.users.halfop'));

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test +h RegularUser');
    });
  });

  describe('mode removal', () => {
    it('should send MODE -v command when removing voice', () => {
      const usersWithVoice = [
        {
          nick: 'VoiceUser',
          channels: [{ name: '#test', flags: ['v'] }],
        },
        {
          nick: 'testuser',
          channels: [{ name: '#test', flags: ['o'] }],
        },
      ];
      vi.spyOn(usersStore, 'getUsersFromChannelSortedByMode').mockReturnValue(usersWithVoice as any);

      render(<UsersTab channelName="#test" />);

      fireEvent.click(screen.getByTestId('user-actions-VoiceUser'));
      fireEvent.click(screen.getByText('channelSettings.users.remove channelSettings.users.voice'));

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test -v VoiceUser');
    });
  });

  describe('empty state', () => {
    it('should show no users message when list is empty', () => {
      vi.spyOn(usersStore, 'getUsersFromChannelSortedByMode').mockReturnValue([]);

      render(<UsersTab channelName="#test" />);

      expect(screen.getByText('channelSettings.users.noUsers')).toBeInTheDocument();
    });
  });

  describe('owner permissions', () => {
    it('should allow owner to modify all users below them', () => {
      vi.spyOn(usersStore, 'getCurrentUserChannelModes').mockReturnValue(['q']);

      const users = [
        { nick: 'Admin', channels: [{ name: '#test', flags: ['a'] }] },
        { nick: 'Operator', channels: [{ name: '#test', flags: ['o'] }] },
        { nick: 'testuser', channels: [{ name: '#test', flags: ['q'] }] },
      ];
      vi.spyOn(usersStore, 'getUsersFromChannelSortedByMode').mockReturnValue(users as any);

      render(<UsersTab channelName="#test" />);

      expect(screen.getByTestId('user-actions-Admin')).toBeInTheDocument();
      expect(screen.getByTestId('user-actions-Operator')).toBeInTheDocument();
    });
  });
});
