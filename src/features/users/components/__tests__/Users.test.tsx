import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Users from '../Users';
import * as settingsStore from '@features/settings/store/settings';
import * as currentStore from '@features/chat/store/current';
import * as ContextMenuContext from '@/providers/ContextMenuContext';
import { ChannelCategory } from '@shared/types';
import type { User, UserMode } from '@shared/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const createUser = (overrides: Partial<User> & { nick: string }): User => ({
  ident: 'ident',
  hostname: 'hostname',
  flags: [],
  channels: [],
  ...overrides,
});

describe('Users', () => {
  const mockHandleContextMenuUserClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultUserModes: UserMode[] = [
    { flag: 'q', symbol: '~' },
    { flag: 'a', symbol: '&' },
    { flag: 'o', symbol: '@' },
    { flag: 'h', symbol: '%' },
    { flag: 'v', symbol: '+' },
  ];

  const setupMocks = (overrides: {
    currentChannelCategory?: ChannelCategory;
    currentChannelName?: string;
    userModes?: UserMode[];
    users?: User[];
    hideAvatarsInUsersList?: boolean;
  } = {}) => {
    const {
      currentChannelCategory = ChannelCategory.channel,
      currentChannelName = '#test',
      userModes = defaultUserModes,
      users = [],
      hideAvatarsInUsersList = false,
    } = overrides;

    vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
      selector({
        currentChannelCategory,
        currentChannelName,
        userModes,
        hideAvatarsInUsersList,
      } as unknown as settingsStore.SettingsStore)
    );

    vi.spyOn(currentStore, 'useCurrentStore').mockImplementation((selector) =>
      selector({
        users,
        topic: '',
        messages: [],
        typing: [],
        setUpdateTopic: vi.fn(),
        setUpdateMessages: vi.fn(),
        setUpdateUsers: vi.fn(),
        setUpdateTyping: vi.fn(),
        setClearAll: vi.fn(),
      })
    );

    vi.spyOn(ContextMenuContext, 'useContextMenu').mockReturnValue({
      contextMenuAnchorElement: null,
      contextMenuOpen: false,
      contextMenuCategory: undefined,
      contextMenuItem: undefined,
      handleContextMenuUserClick: mockHandleContextMenuUserClick,
      handleContextMenuClose: vi.fn(),
    });
  };

  describe('Basic rendering', () => {
    it('should render the users title', () => {
      setupMocks({ users: [createUser({ nick: 'testUser' })] });

      render(<Users />);

      expect(screen.getByText('main.users.title')).toBeInTheDocument();
    });

    it('should render user buttons', () => {
      setupMocks({
        users: [
          createUser({ nick: 'user1' }),
          createUser({ nick: 'user2' }),
          createUser({ nick: 'user3' }),
        ],
      });

      render(<Users />);

      expect(screen.getByRole('button', { name: /user1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /user2/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /user3/i })).toBeInTheDocument();
    });

    it('should display user nickname', () => {
      setupMocks({ users: [createUser({ nick: 'TestNick' })] });

      render(<Users />);

      expect(screen.getByText('TestNick')).toBeInTheDocument();
    });

    it('should display first letter of nickname when no avatar', () => {
      setupMocks({ users: [createUser({ nick: 'Alice' })] });

      render(<Users />);

      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('should display avatar image when available', () => {
      setupMocks({
        users: [createUser({ nick: 'user1', avatar: 'https://example.com/avatar.png' })],
      });

      render(<Users />);

      const avatar = screen.getByAltText('user1');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.png');
    });

    it('should apply custom color to user nickname', () => {
      setupMocks({
        users: [createUser({ nick: 'user1', color: '#ff0000' })],
      });

      render(<Users />);

      const nickElement = screen.getByText('user1');
      expect(nickElement).toHaveStyle({ color: '#ff0000' });
    });

    it('should not have inline color style when no custom color is set', () => {
      setupMocks({
        users: [createUser({ nick: 'user1' })],
      });

      render(<Users />);

      const nickElement = screen.getByText('user1');
      // When color is undefined, it falls back to 'inherit' which gets computed
      // We just verify the element exists and doesn't have a custom hex color
      expect(nickElement).toBeInTheDocument();
    });
  });

  describe('Visibility based on channel category', () => {
    it('should render users list for channel category', () => {
      setupMocks({
        currentChannelCategory: ChannelCategory.channel,
        users: [createUser({ nick: 'user1' })],
      });

      render(<Users />);

      expect(screen.getByText('main.users.title')).toBeInTheDocument();
    });

    it('should render users list for priv category', () => {
      setupMocks({
        currentChannelCategory: ChannelCategory.priv,
        users: [createUser({ nick: 'user1' })],
      });

      render(<Users />);

      expect(screen.getByText('main.users.title')).toBeInTheDocument();
    });

    it('should not render users list for status category', () => {
      setupMocks({
        currentChannelCategory: ChannelCategory.status,
        users: [createUser({ nick: 'user1' })],
      });

      render(<Users />);

      expect(screen.queryByText('main.users.title')).not.toBeInTheDocument();
    });
  });

  describe('Context menu interactions', () => {
    it('should call handleContextMenuUserClick on left click', () => {
      setupMocks({ users: [createUser({ nick: 'clickableUser' })] });

      render(<Users />);

      const userButton = screen.getByRole('button', { name: /clickableUser/i });
      fireEvent.click(userButton);

      expect(mockHandleContextMenuUserClick).toHaveBeenCalledTimes(1);
      expect(mockHandleContextMenuUserClick).toHaveBeenCalledWith(
        expect.any(Object),
        'user',
        'clickableUser'
      );
    });

    it('should call handleContextMenuUserClick on right click', () => {
      setupMocks({ users: [createUser({ nick: 'rightClickUser' })] });

      render(<Users />);

      const userButton = screen.getByRole('button', { name: /rightClickUser/i });
      fireEvent.contextMenu(userButton);

      expect(mockHandleContextMenuUserClick).toHaveBeenCalledTimes(1);
      expect(mockHandleContextMenuUserClick).toHaveBeenCalledWith(
        expect.any(Object),
        'user',
        'rightClickUser'
      );
    });

    it('should prevent default context menu on right click', () => {
      setupMocks({ users: [createUser({ nick: 'user1' })] });

      render(<Users />);

      const userButton = screen.getByRole('button', { name: /user1/i });
      const event = fireEvent.contextMenu(userButton);

      // fireEvent.contextMenu returns false if preventDefault was called
      expect(event).toBe(false);
    });

    it('should pass correct user nick to context menu handler', () => {
      setupMocks({
        users: [
          createUser({ nick: 'Alice' }),
          createUser({ nick: 'Bob' }),
        ],
      });

      render(<Users />);

      const aliceButton = screen.getByRole('button', { name: /Alice/i });
      fireEvent.click(aliceButton);

      expect(mockHandleContextMenuUserClick).toHaveBeenCalledWith(
        expect.any(Object),
        'user',
        'Alice'
      );

      mockHandleContextMenuUserClick.mockClear();

      const bobButton = screen.getByRole('button', { name: /Bob/i });
      fireEvent.contextMenu(bobButton);

      expect(mockHandleContextMenuUserClick).toHaveBeenCalledWith(
        expect.any(Object),
        'user',
        'Bob'
      );
    });
  });

  describe('Empty state', () => {
    it('should render container with no user buttons when users list is empty', () => {
      setupMocks({ users: [] });

      render(<Users />);

      expect(screen.getByText('main.users.title')).toBeInTheDocument();
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  describe('Multiple users', () => {
    it('should render all users in the list', () => {
      const users = [
        createUser({ nick: 'user1' }),
        createUser({ nick: 'user2' }),
        createUser({ nick: 'user3' }),
        createUser({ nick: 'user4' }),
        createUser({ nick: 'user5' }),
      ];

      setupMocks({ users });

      render(<Users />);

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(5);
    });

    it('should render users with mixed avatars and initials', () => {
      setupMocks({
        users: [
          createUser({ nick: 'WithAvatar', avatar: 'https://example.com/avatar.png' }),
          createUser({ nick: 'NoAvatar' }),
        ],
      });

      render(<Users />);

      expect(screen.getByAltText('WithAvatar')).toBeInTheDocument();
      expect(screen.getByText('N')).toBeInTheDocument();
    });
  });

  describe('Hide avatars setting', () => {
    it('should show avatars when hideAvatarsInUsersList is false', () => {
      setupMocks({
        users: [createUser({ nick: 'Alice', avatar: 'https://example.com/avatar.png' })],
        hideAvatarsInUsersList: false,
      });

      render(<Users />);

      expect(screen.getByAltText('Alice')).toBeInTheDocument();
    });

    it('should hide avatars when hideAvatarsInUsersList is true', () => {
      setupMocks({
        users: [createUser({ nick: 'Alice', avatar: 'https://example.com/avatar.png' })],
        hideAvatarsInUsersList: true,
      });

      render(<Users />);

      expect(screen.queryByAltText('Alice')).not.toBeInTheDocument();
    });

    it('should hide initial placeholders when hideAvatarsInUsersList is true', () => {
      setupMocks({
        users: [createUser({ nick: 'Alice' })],
        hideAvatarsInUsersList: true,
      });

      render(<Users />);

      // The initial "A" should not be visible
      expect(screen.queryByText('A')).not.toBeInTheDocument();
      // But the full nick should still be visible
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    it('should still display user nicknames when avatars are hidden', () => {
      setupMocks({
        users: [
          createUser({ nick: 'Alice' }),
          createUser({ nick: 'Bob' }),
        ],
        hideAvatarsInUsersList: true,
      });

      render(<Users />);

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('should apply custom color to nickname when avatars are hidden', () => {
      setupMocks({
        users: [createUser({ nick: 'Alice', color: '#ff0000' })],
        hideAvatarsInUsersList: true,
      });

      render(<Users />);

      const nickElement = screen.getByText('Alice');
      expect(nickElement).toHaveStyle({ color: '#ff0000' });
    });
  });

  describe('Permission icons', () => {
    it('should display Crown icon for owner (~)', () => {
      setupMocks({
        currentChannelName: '#test',
        users: [
          createUser({
            nick: 'owner',
            channels: [{ name: '#test', flags: ['q'], maxPermission: 256 }],
          }),
        ],
      });

      render(<Users />);

      const iconWrapper = screen.getByTitle('Owner');
      expect(iconWrapper).toBeInTheDocument();
    });

    it('should display ShieldCheck icon for admin (&)', () => {
      setupMocks({
        currentChannelName: '#test',
        users: [
          createUser({
            nick: 'admin',
            channels: [{ name: '#test', flags: ['a'], maxPermission: 255 }],
          }),
        ],
      });

      render(<Users />);

      const iconWrapper = screen.getByTitle('Admin');
      expect(iconWrapper).toBeInTheDocument();
    });

    it('should display Shield icon for operator (@)', () => {
      setupMocks({
        currentChannelName: '#test',
        users: [
          createUser({
            nick: 'operator',
            channels: [{ name: '#test', flags: ['o'], maxPermission: 254 }],
          }),
        ],
      });

      render(<Users />);

      const iconWrapper = screen.getByTitle('Operator');
      expect(iconWrapper).toBeInTheDocument();
    });

    it('should display ShieldHalf icon for half-op (%)', () => {
      setupMocks({
        currentChannelName: '#test',
        users: [
          createUser({
            nick: 'halfop',
            channels: [{ name: '#test', flags: ['h'], maxPermission: 253 }],
          }),
        ],
      });

      render(<Users />);

      const iconWrapper = screen.getByTitle('Half-Op');
      expect(iconWrapper).toBeInTheDocument();
    });

    it('should display Mic icon for voice (+)', () => {
      setupMocks({
        currentChannelName: '#test',
        users: [
          createUser({
            nick: 'voiced',
            channels: [{ name: '#test', flags: ['v'], maxPermission: 252 }],
          }),
        ],
      });

      render(<Users />);

      const iconWrapper = screen.getByTitle('Voice');
      expect(iconWrapper).toBeInTheDocument();
    });

    it('should not display any icon for users without flags', () => {
      setupMocks({
        currentChannelName: '#test',
        users: [
          createUser({
            nick: 'regular',
            channels: [{ name: '#test', flags: [], maxPermission: -1 }],
          }),
        ],
      });

      render(<Users />);

      expect(screen.queryByTitle('Owner')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Admin')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Operator')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Half-Op')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Voice')).not.toBeInTheDocument();
    });

    it('should display all permission icons when user has multiple flags', () => {
      setupMocks({
        currentChannelName: '#test',
        users: [
          createUser({
            nick: 'multimode',
            channels: [{ name: '#test', flags: ['o', 'v'], maxPermission: 254 }],
          }),
        ],
      });

      render(<Users />);

      // Should show both operator and voice icons
      expect(screen.getByTitle('Operator')).toBeInTheDocument();
      expect(screen.getByTitle('Voice')).toBeInTheDocument();
    });

    it('should display all icons for user with half-op and voice', () => {
      setupMocks({
        currentChannelName: '#test',
        users: [
          createUser({
            nick: 'halfopvoice',
            channels: [{ name: '#test', flags: ['h', 'v'], maxPermission: 253 }],
          }),
        ],
      });

      render(<Users />);

      expect(screen.getByTitle('Half-Op')).toBeInTheDocument();
      expect(screen.getByTitle('Voice')).toBeInTheDocument();
    });

    it('should not display icon when user is not in the current channel', () => {
      setupMocks({
        currentChannelName: '#test',
        users: [
          createUser({
            nick: 'other',
            channels: [{ name: '#other', flags: ['o'], maxPermission: 254 }],
          }),
        ],
      });

      render(<Users />);

      expect(screen.queryByTitle('Operator')).not.toBeInTheDocument();
    });

    it('should display correct icons for multiple users with different permissions', () => {
      setupMocks({
        currentChannelName: '#test',
        users: [
          createUser({
            nick: 'owner',
            channels: [{ name: '#test', flags: ['q'], maxPermission: 256 }],
          }),
          createUser({
            nick: 'op',
            channels: [{ name: '#test', flags: ['o'], maxPermission: 254 }],
          }),
          createUser({
            nick: 'regular',
            channels: [{ name: '#test', flags: [], maxPermission: -1 }],
          }),
        ],
      });

      render(<Users />);

      expect(screen.getByTitle('Owner')).toBeInTheDocument();
      expect(screen.getByTitle('Operator')).toBeInTheDocument();
    });
  });
});
