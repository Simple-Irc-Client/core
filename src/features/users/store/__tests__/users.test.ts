import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  useUsersStore,
  setAddUser as setAddUserExport,
  setUserAvatar as setUserAvatarExport,
  setUserColor as setUserColorExport,
  setUserAway as setUserAwayExport,
  setUserDisplayName as setUserDisplayNameExport,
  setUserStatus as setUserStatusExport,
  setUserHomepage as setUserHomepageExport,
  setUserBot as setUserBotExport,
  setUserAccount as setUserAccountExport,
  setUserHost as setUserHostExport,
  setUserRealname as setUserRealnameExport,
  getUserChannels,
  getUser,
  getHasUser,
  getUsersFromChannelSortedByMode,
  getUsersFromChannelSortedByAZ,
  getCurrentUserChannelModes,
  pendingMetadata,
} from '../users';
import type { User, UserChannel } from '@shared/types';

const createUser = (nick: string, channels: UserChannel[]): User => ({
  nick,
  ident: 'ident',
  hostname: 'hostname',
  flags: [],
  channels,
});

vi.mock('@features/settings/store/settings', () => ({
  getCurrentChannelName: vi.fn(() => '#test'),
  getCurrentNick: vi.fn(() => 'TestUser'),
}));

vi.mock('@features/chat/store/current', () => ({
  useCurrentStore: {
    getState: () => ({
      setUpdateUsers: vi.fn(),
    }),
  },
}));

vi.mock('@features/channels/store/channels', () => ({
  clearTyping: vi.fn(),
  setAddMessage: vi.fn(),
}));

describe('users store', () => {
  beforeEach(() => {
    useUsersStore.setState({ users: [] });
    pendingMetadata.clear();
    vi.clearAllMocks();
  });

  describe('setAddUser', () => {
    it('should add a new user to the store', () => {
      const user = createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]);

      useUsersStore.getState().setAddUser(user);

      expect(useUsersStore.getState().users.length).toBe(1);
      expect(useUsersStore.getState().users[0]?.nick).toBe('TestUser');
    });

    it('should add multiple users to the store', () => {
      useUsersStore.getState().setAddUser(createUser('User1', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));
      useUsersStore.getState().setAddUser(createUser('User2', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      expect(useUsersStore.getState().users.length).toBe(2);
    });

    it('should preserve user properties', () => {
      const user: User = {
        nick: 'TestUser',
        ident: 'testident',
        hostname: 'test.host.com',
        flags: ['away'],
        avatar: 'https://example.com/avatar.png',
        color: '#ff0000',
        channels: [{ name: '#channel1', flags: ['o'], maxPermission: 3 }],
      };

      useUsersStore.getState().setAddUser(user);

      const storedUser = useUsersStore.getState().users[0];
      expect(storedUser?.nick).toBe('TestUser');
      expect(storedUser?.ident).toBe('testident');
      expect(storedUser?.hostname).toBe('test.host.com');
      expect(storedUser?.flags).toEqual(['away']);
      expect(storedUser?.avatar).toBe('https://example.com/avatar.png');
      expect(storedUser?.color).toBe('#ff0000');
    });
  });

  describe('setRemoveUser', () => {
    it('should remove user from a specific channel', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
        { name: '#channel2', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setRemoveUser('TestUser', '#channel1');

      const user = getUser('TestUser');
      expect(user?.channels.length).toBe(1);
      expect(user?.channels[0]?.name).toBe('#channel2');
    });

    it('should remove user entirely when last channel is removed', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setRemoveUser('TestUser', '#channel1');

      expect(getUser('TestUser')).toBeUndefined();
      expect(useUsersStore.getState().users.length).toBe(0);
    });

    it('should not affect other users when removing', () => {
      useUsersStore.getState().setAddUser(createUser('User1', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));
      useUsersStore.getState().setAddUser(createUser('User2', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setRemoveUser('User1', '#channel1');

      expect(getUser('User1')).toBeUndefined();
      expect(getUser('User2')).toBeDefined();
    });
  });

  describe('setQuitUser', () => {
    it('should remove user entirely from the store', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
        { name: '#channel2', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setQuitUser('TestUser');

      expect(getUser('TestUser')).toBeUndefined();
      expect(useUsersStore.getState().users.length).toBe(0);
    });

    it('should not affect other users when quitting', () => {
      useUsersStore.getState().setAddUser(createUser('User1', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));
      useUsersStore.getState().setAddUser(createUser('User2', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setQuitUser('User1');

      expect(getUser('User1')).toBeUndefined();
      expect(getUser('User2')).toBeDefined();
      expect(useUsersStore.getState().users.length).toBe(1);
    });
  });

  describe('setRenameUser', () => {
    it('should rename user without duplicating', () => {
      useUsersStore.getState().setAddUser(createUser('OldNick', [
        { name: '#channel1', flags: [], maxPermission: -1 },
        { name: '#channel2', flags: [], maxPermission: -1 },
      ]));

      expect(getUser('OldNick')).toBeDefined();
      expect(getUser('NewNick')).toBeUndefined();

      useUsersStore.getState().setRenameUser('OldNick', 'NewNick');

      expect(getUser('OldNick')).toBeUndefined();
      expect(getUser('NewNick')).toBeDefined();
      expect(useUsersStore.getState().users.length).toBe(1);
    });

    it('should preserve channels after rename', () => {
      useUsersStore.getState().setAddUser(createUser('OldNick', [
        { name: '#channel1', flags: ['o'], maxPermission: 3 },
        { name: '#channel2', flags: ['v'], maxPermission: 1 },
      ]));

      useUsersStore.getState().setRenameUser('OldNick', 'NewNick');

      const user = getUser('NewNick');
      expect(user?.channels.length).toBe(2);
      expect(user?.channels[0]?.name).toBe('#channel1');
      expect(user?.channels[0]?.flags).toEqual(['o']);
      expect(user?.channels[1]?.name).toBe('#channel2');
      expect(user?.channels[1]?.flags).toEqual(['v']);
    });

    it('should not create duplicate channels when renaming', () => {
      useUsersStore.getState().setAddUser(createUser('OldNick', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setRenameUser('OldNick', 'TempNick');
      useUsersStore.getState().setRenameUser('TempNick', 'FinalNick');

      const user = getUser('FinalNick');
      expect(user?.channels.length).toBe(1);
      expect(useUsersStore.getState().users.length).toBe(1);
    });

    it('should not affect other users when renaming', () => {
      useUsersStore.getState().setAddUser(createUser('User1', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));
      useUsersStore.getState().setAddUser(createUser('User2', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setRenameUser('User1', 'User1Renamed');

      expect(getUser('User1')).toBeUndefined();
      expect(getUser('User1Renamed')).toBeDefined();
      expect(getUser('User2')).toBeDefined();
      expect(useUsersStore.getState().users.length).toBe(2);
    });
  });

  describe('setJoinUser', () => {
    it('should add channel without duplicating existing channels', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setJoinUser('TestUser', '#channel2');

      const channels = getUserChannels('TestUser');
      expect(channels).toEqual(['#channel1', '#channel2']);
      expect(channels.length).toBe(2);
    });

    it('should not affect other users when joining channel', () => {
      useUsersStore.getState().setAddUser(createUser('User1', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));
      useUsersStore.getState().setAddUser(createUser('User2', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setJoinUser('User1', '#channel2');

      expect(getUserChannels('User1')).toEqual(['#channel1', '#channel2']);
      expect(getUserChannels('User2')).toEqual(['#channel1']);
    });

    it('should add channel with default flags', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setJoinUser('TestUser', '#channel2');

      const user = getUser('TestUser');
      const newChannel = user?.channels.find((c) => c.name === '#channel2');
      expect(newChannel?.flags).toEqual([]);
      expect(newChannel?.maxPermission).toBe(-1);
    });

    it('should add channel with provided flags', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setJoinUser('TestUser', '#channel2', ['o'], 3);

      const user = getUser('TestUser');
      const newChannel = user?.channels.find((c) => c.name === '#channel2');
      expect(newChannel?.flags).toEqual(['o']);
      expect(newChannel?.maxPermission).toBe(3);
    });

    it('should update flags on existing channel from NAMES response', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      // Simulate NAMES response arriving after JOIN (with ops)
      useUsersStore.getState().setJoinUser('TestUser', '#channel1', ['o'], 3);

      const user = getUser('TestUser');
      const channel = user?.channels.find((c) => c.name === '#channel1');
      expect(channel?.flags).toEqual(['o']);
      expect(channel?.maxPermission).toBe(3);
    });

    it('should not overwrite flags with empty flags on existing channel', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: ['o'], maxPermission: 3 },
      ]));

      // Join without flags should not clear existing flags
      useUsersStore.getState().setJoinUser('TestUser', '#channel1');

      const user = getUser('TestUser');
      const channel = user?.channels.find((c) => c.name === '#channel1');
      expect(channel?.flags).toEqual(['o']);
      expect(channel?.maxPermission).toBe(3);
    });
  });

  describe('setUserAvatar', () => {
    it('should set avatar for user', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setUserAvatar('TestUser', 'https://example.com/avatar.png');

      expect(getUser('TestUser')?.avatar).toBe('https://example.com/avatar.png');
    });

    it('should update existing avatar', () => {
      const user = createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]);
      user.avatar = 'https://old-avatar.png';
      useUsersStore.getState().setAddUser(user);

      useUsersStore.getState().setUserAvatar('TestUser', 'https://new-avatar.png');

      expect(getUser('TestUser')?.avatar).toBe('https://new-avatar.png');
    });

    it('should not affect other users', () => {
      useUsersStore.getState().setAddUser(createUser('User1', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));
      useUsersStore.getState().setAddUser(createUser('User2', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setUserAvatar('User1', 'https://avatar.png');

      expect(getUser('User1')?.avatar).toBe('https://avatar.png');
      expect(getUser('User2')?.avatar).toBeUndefined();
    });

    it('should buffer avatar when user does not exist', () => {
      setUserAvatarExport('NewUser', 'https://avatar.png');

      expect(getUser('NewUser')).toBeUndefined();
      expect(pendingMetadata.get('NewUser')).toEqual({ avatar: 'https://avatar.png' });
    });
  });

  describe('setUserColor', () => {
    it('should set color for user', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setUserColor('TestUser', '#ff0000');

      expect(getUser('TestUser')?.color).toBe('#ff0000');
    });

    it('should update existing color', () => {
      const user = createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]);
      user.color = '#000000';
      useUsersStore.getState().setAddUser(user);

      useUsersStore.getState().setUserColor('TestUser', '#ffffff');

      expect(getUser('TestUser')?.color).toBe('#ffffff');
    });

    it('should buffer color when user does not exist', () => {
      setUserColorExport('NewUser', '#ff0000');

      expect(getUser('NewUser')).toBeUndefined();
      expect(pendingMetadata.get('NewUser')).toEqual({ color: '#ff0000' });
    });
  });

  describe('setUserStatus', () => {
    it('should set user status', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setUserStatus('TestUser', 'Working from home');

      expect(getUser('TestUser')?.status).toBe('Working from home');
    });

    it('should update existing user status', () => {
      const user = createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]);
      user.status = 'Old status';
      useUsersStore.getState().setAddUser(user);

      useUsersStore.getState().setUserStatus('TestUser', 'New status');

      expect(getUser('TestUser')?.status).toBe('New status');
    });

    it('should clear user status with undefined', () => {
      const user = createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]);
      user.status = 'Some status';
      useUsersStore.getState().setAddUser(user);

      useUsersStore.getState().setUserStatus('TestUser', undefined);

      expect(getUser('TestUser')?.status).toBeUndefined();
    });

    it('should buffer status when user does not exist', () => {
      setUserStatusExport('NewUser', 'Away');

      expect(getUser('NewUser')).toBeUndefined();
      expect(pendingMetadata.get('NewUser')).toEqual({ status: 'Away' });
    });
  });

  describe('setUserHomepage', () => {
    it('should set user homepage', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setUserHomepage('TestUser', 'https://example.com');

      expect(getUser('TestUser')?.homepage).toBe('https://example.com');
    });

    it('should clear user homepage with undefined', () => {
      const user = createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]);
      user.homepage = 'https://example.com';
      useUsersStore.getState().setAddUser(user);

      useUsersStore.getState().setUserHomepage('TestUser', undefined);

      expect(getUser('TestUser')?.homepage).toBeUndefined();
    });

    it('should buffer homepage when user does not exist', () => {
      setUserHomepageExport('NewUser', 'https://example.com');

      expect(getUser('NewUser')).toBeUndefined();
      expect(pendingMetadata.get('NewUser')).toEqual({ homepage: 'https://example.com' });
    });
  });

  describe('setUserBot', () => {
    it('should set user as bot', () => {
      useUsersStore.getState().setAddUser(createUser('BotUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setUserBot('BotUser', true);

      expect(getUser('BotUser')?.bot).toBe(true);
    });

    it('should clear bot flag with false', () => {
      const user = createUser('BotUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]);
      user.bot = true;
      useUsersStore.getState().setAddUser(user);

      useUsersStore.getState().setUserBot('BotUser', false);

      expect(getUser('BotUser')?.bot).toBe(false);
    });

    it('should not update user when bot value is unchanged', () => {
      const user = createUser('BotUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]);
      user.bot = true;
      useUsersStore.getState().setAddUser(user);

      const userBefore = getUser('BotUser');
      useUsersStore.getState().setUserBot('BotUser', true);
      const userAfter = getUser('BotUser');

      expect(userBefore).toBe(userAfter);
    });

    it('should buffer bot when user does not exist', () => {
      setUserBotExport('NewUser', true);

      expect(getUser('NewUser')).toBeUndefined();
      expect(pendingMetadata.get('NewUser')).toEqual({ bot: true });
    });
  });

  describe('setUpdateUserFlag', () => {
    it('should add flag to user channel', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setUpdateUserFlag('TestUser', '#channel1', '+', 'o', []);

      const user = getUser('TestUser');
      expect(user?.channels[0]?.flags).toEqual(['o']);
    });

    it('should remove flag from user channel', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: ['o', 'v'], maxPermission: 3 },
      ]));

      useUsersStore.getState().setUpdateUserFlag('TestUser', '#channel1', '-', 'o', []);

      const user = getUser('TestUser');
      expect(user?.channels[0]?.flags).toEqual(['v']);
    });

    it('should only affect specified channel', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
        { name: '#channel2', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setUpdateUserFlag('TestUser', '#channel1', '+', 'o', []);

      const user = getUser('TestUser');
      expect(user?.channels[0]?.flags).toEqual(['o']);
      expect(user?.channels[1]?.flags).toEqual([]);
    });
  });

  describe('getUser', () => {
    it('should return user by nick', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      const user = getUser('TestUser');
      expect(user).toBeDefined();
      expect(user?.nick).toBe('TestUser');
    });

    it('should return undefined for non-existent user', () => {
      const user = getUser('NonExistent');
      expect(user).toBeUndefined();
    });
  });

  describe('getHasUser', () => {
    it('should return true for existing user', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      expect(getHasUser('TestUser')).toBe(true);
    });

    it('should return false for non-existent user', () => {
      expect(getHasUser('NonExistent')).toBe(false);
    });
  });

  describe('getUserChannels', () => {
    it('should return channels without duplicates', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
        { name: '#channel2', flags: [], maxPermission: -1 },
      ]));

      const channels = getUserChannels('TestUser');
      expect(channels).toEqual(['#channel1', '#channel2']);
      expect(channels.length).toBe(2);
    });

    it('should return empty array for non-existent user', () => {
      const channels = getUserChannels('NonExistent');
      expect(channels).toEqual([]);
    });

    it('should return correct channels after rename', () => {
      useUsersStore.getState().setAddUser(createUser('OldNick', [
        { name: '#channel1', flags: [], maxPermission: -1 },
        { name: '#channel2', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setRenameUser('OldNick', 'NewNick');

      const oldChannels = getUserChannels('OldNick');
      const newChannels = getUserChannels('NewNick');

      expect(oldChannels).toEqual([]);
      expect(newChannels).toEqual(['#channel1', '#channel2']);
      expect(newChannels.length).toBe(2);
    });
  });

  describe('getUsersFromChannelSortedByMode', () => {
    it('should return users in channel sorted by mode', () => {
      useUsersStore.getState().setAddUser(createUser('RegularUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));
      useUsersStore.getState().setAddUser(createUser('OpUser', [
        { name: '#channel1', flags: ['o'], maxPermission: 3 },
      ]));
      useUsersStore.getState().setAddUser(createUser('VoiceUser', [
        { name: '#channel1', flags: ['v'], maxPermission: 1 },
      ]));

      const users = getUsersFromChannelSortedByMode('#channel1');

      expect(users[0]?.nick).toBe('OpUser');
      expect(users[1]?.nick).toBe('VoiceUser');
      expect(users[2]?.nick).toBe('RegularUser');
    });

    it('should sort alphabetically when modes are equal', () => {
      useUsersStore.getState().setAddUser(createUser('Zack', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));
      useUsersStore.getState().setAddUser(createUser('Alice', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));
      useUsersStore.getState().setAddUser(createUser('Bob', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      const users = getUsersFromChannelSortedByMode('#channel1');

      expect(users[0]?.nick).toBe('Alice');
      expect(users[1]?.nick).toBe('Bob');
      expect(users[2]?.nick).toBe('Zack');
    });

    it('should return empty array for non-existent channel', () => {
      const users = getUsersFromChannelSortedByMode('#nonexistent');
      expect(users).toEqual([]);
    });
  });

  describe('getUsersFromChannelSortedByAZ', () => {
    it('should return users sorted alphabetically', () => {
      useUsersStore.getState().setAddUser(createUser('Zack', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));
      useUsersStore.getState().setAddUser(createUser('Alice', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));
      useUsersStore.getState().setAddUser(createUser('Bob', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      const users = getUsersFromChannelSortedByAZ('#channel1');

      expect(users[0]?.nick).toBe('Alice');
      expect(users[1]?.nick).toBe('Bob');
      expect(users[2]?.nick).toBe('Zack');
    });

    it('should be case insensitive', () => {
      useUsersStore.getState().setAddUser(createUser('alice', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));
      useUsersStore.getState().setAddUser(createUser('BOB', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));
      useUsersStore.getState().setAddUser(createUser('Carol', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      const users = getUsersFromChannelSortedByAZ('#channel1');

      expect(users[0]?.nick).toBe('alice');
      expect(users[1]?.nick).toBe('BOB');
      expect(users[2]?.nick).toBe('Carol');
    });
  });

  describe('getCurrentUserChannelModes', () => {
    it('should return current user channel modes', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#test', flags: ['o', 'v'], maxPermission: 3 },
      ]));

      const modes = getCurrentUserChannelModes('#test');
      expect(modes).toEqual(['o', 'v']);
    });

    it('should return empty array when user not in channel', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#other', flags: ['o'], maxPermission: 3 },
      ]));

      const modes = getCurrentUserChannelModes('#test');
      expect(modes).toEqual([]);
    });

    it('should return empty array when user does not exist', () => {
      const modes = getCurrentUserChannelModes('#test');
      expect(modes).toEqual([]);
    });
  });

  describe('immutability', () => {
    it('should not mutate original user object when renaming', () => {
      const originalUser = createUser('OldNick', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]);

      useUsersStore.getState().setAddUser(originalUser);

      const userBeforeRename = useUsersStore.getState().users[0];
      useUsersStore.getState().setRenameUser('OldNick', 'NewNick');
      const userAfterRename = useUsersStore.getState().users[0];

      expect(userBeforeRename).not.toBe(userAfterRename);
    });

    it('should not mutate original channels array when joining', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      const userBefore = useUsersStore.getState().users[0];
      const channelsBefore = userBefore?.channels;

      useUsersStore.getState().setJoinUser('TestUser', '#channel2');

      const userAfter = useUsersStore.getState().users[0];
      const channelsAfter = userAfter?.channels;

      expect(channelsBefore).not.toBe(channelsAfter);
      expect(channelsBefore?.length).toBe(1);
      expect(channelsAfter?.length).toBe(2);
    });

    it('should not mutate original user object when updating avatar', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      const userBefore = useUsersStore.getState().users[0];
      useUsersStore.getState().setUserAvatar('TestUser', 'https://example.com/avatar.png');
      const userAfter = useUsersStore.getState().users[0];

      expect(userBefore).not.toBe(userAfter);
      expect(userBefore?.avatar).toBeUndefined();
      expect(userAfter?.avatar).toBe('https://example.com/avatar.png');
    });

    it('should not mutate original user object when updating color', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      const userBefore = useUsersStore.getState().users[0];
      useUsersStore.getState().setUserColor('TestUser', '#ff0000');
      const userAfter = useUsersStore.getState().users[0];

      expect(userBefore).not.toBe(userAfter);
      expect(userBefore?.color).toBeUndefined();
      expect(userAfter?.color).toBe('#ff0000');
    });

    it('should not mutate original channels when updating flags', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      const userBefore = useUsersStore.getState().users[0];
      const channelBefore = userBefore?.channels[0];

      useUsersStore.getState().setUpdateUserFlag('TestUser', '#channel1', '+', 'o', []);

      const userAfter = useUsersStore.getState().users[0];
      const channelAfter = userAfter?.channels[0];

      expect(channelBefore).not.toBe(channelAfter);
      expect(channelBefore?.flags).toEqual([]);
      expect(channelAfter?.flags).toEqual(['o']);
    });

    it('should not mutate original channels when removing user from channel', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
        { name: '#channel2', flags: [], maxPermission: -1 },
      ]));

      const userBefore = useUsersStore.getState().users[0];
      const channelsBefore = userBefore?.channels;

      useUsersStore.getState().setRemoveUser('TestUser', '#channel1');

      const userAfter = useUsersStore.getState().users[0];
      const channelsAfter = userAfter?.channels;

      expect(channelsBefore).not.toBe(channelsAfter);
      expect(channelsBefore?.length).toBe(2);
      expect(channelsAfter?.length).toBe(1);
      expect(channelsAfter?.[0]?.name).toBe('#channel2');
    });
  });

  describe('metadata before JOIN (QUIT + METADATA + JOIN race)', () => {
    it('should preserve avatar when METADATA arrives before JOIN after QUIT', () => {
      // User is in a channel
      useUsersStore.getState().setAddUser(createUser('ProrokCodzienny', [
        { name: '#Religie', flags: [], maxPermission: -1 },
      ]));

      // User QUITs - removed from store
      useUsersStore.getState().setQuitUser('ProrokCodzienny');
      expect(getUser('ProrokCodzienny')).toBeUndefined();

      // METADATA avatar arrives before JOIN - buffered, not in store
      setUserAvatarExport('ProrokCodzienny', 'https://gravatar.com/avatar/abc.jpg');
      expect(getUser('ProrokCodzienny')).toBeUndefined();
      expect(pendingMetadata.has('ProrokCodzienny')).toBe(true);

      // JOIN arrives - exported setAddUser applies buffered metadata
      setAddUserExport({
        nick: 'ProrokCodzienny',
        ident: '~ProrokCod',
        hostname: '2BD8A2CC.22667CD.897C74C8.IP',
        flags: [],
        channels: [{ name: '#Religie', flags: [], maxPermission: -1 }],
      });

      const user = getUser('ProrokCodzienny');
      expect(user?.avatar).toBe('https://gravatar.com/avatar/abc.jpg');
      expect(user?.ident).toBe('~ProrokCod');
      expect(user?.hostname).toBe('2BD8A2CC.22667CD.897C74C8.IP');
      expect(user?.channels).toEqual([{ name: '#Religie', flags: [], maxPermission: -1 }]);
      expect(pendingMetadata.has('ProrokCodzienny')).toBe(false);
    });

    it('should preserve color when METADATA arrives before JOIN after QUIT', () => {
      useUsersStore.getState().setAddUser(createUser('User1', [
        { name: '#test', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setQuitUser('User1');
      setUserColorExport('User1', '#ff5500');

      setAddUserExport({
        nick: 'User1',
        ident: 'ident',
        hostname: 'host',
        flags: [],
        channels: [{ name: '#test', flags: [], maxPermission: -1 }],
      });

      const user = getUser('User1');
      expect(user?.color).toBe('#ff5500');
      expect(user?.channels.length).toBe(1);
    });

    it('should preserve multiple metadata fields when they arrive before JOIN', () => {
      // METADATA avatar and away arrive before JOIN (no user in store)
      setUserAvatarExport('NewUser', 'https://example.com/avatar.png');
      setUserAwayExport('NewUser', true, 'gone');
      setUserDisplayNameExport('NewUser', 'Display Name');

      // User should NOT be in the store yet
      expect(getUser('NewUser')).toBeUndefined();

      setAddUserExport({
        nick: 'NewUser',
        ident: 'user',
        hostname: 'host.example.com',
        flags: [],
        channels: [{ name: '#channel', flags: [], maxPermission: -1 }],
      });

      const user = getUser('NewUser');
      expect(user?.avatar).toBe('https://example.com/avatar.png');
      expect(user?.away).toBe(true);
      expect(user?.awayReason).toBe('gone');
      expect(user?.displayName).toBe('Display Name');
      expect(user?.ident).toBe('user');
      expect(user?.hostname).toBe('host.example.com');
      expect(user?.channels.length).toBe(1);
      expect(pendingMetadata.has('NewUser')).toBe(false);
    });

    it('should not leave buffered metadata if JOIN never comes', () => {
      setUserAvatarExport('GhostUser', 'https://example.com/ghost.png');

      // User never joins - should not be in the store
      expect(getUser('GhostUser')).toBeUndefined();
      expect(useUsersStore.getState().users.length).toBe(0);
      // Buffer exists but user is not visible in any channel list
      expect(getUsersFromChannelSortedByMode('#test').length).toBe(0);
    });

    it('should buffer account when user does not exist', () => {
      setUserAccountExport('NewUser', 'account-name');

      expect(getUser('NewUser')).toBeUndefined();
      expect(pendingMetadata.get('NewUser')).toEqual({ account: 'account-name' });
    });

    it('should buffer away when user does not exist', () => {
      setUserAwayExport('NewUser', true, 'gone');

      expect(getUser('NewUser')).toBeUndefined();
      expect(pendingMetadata.get('NewUser')).toEqual({ away: true, awayReason: 'gone' });
    });

    it('should buffer host when user does not exist (CHGHOST before JOIN)', () => {
      setUserHostExport('NewUser', '~newident', 'new.host.com');

      expect(getUser('NewUser')).toBeUndefined();
      expect(pendingMetadata.get('NewUser')).toEqual({ ident: '~newident', hostname: 'new.host.com' });
    });

    it('should apply buffered host when user JOINs', () => {
      setUserHostExport('NewUser', '~updated', 'updated.host');

      setAddUserExport({
        nick: 'NewUser',
        ident: '~original',
        hostname: 'original.host',
        flags: [],
        channels: [{ name: '#test', flags: [], maxPermission: -1 }],
      });

      const user = getUser('NewUser');
      expect(user?.ident).toBe('~updated');
      expect(user?.hostname).toBe('updated.host');
      expect(pendingMetadata.has('NewUser')).toBe(false);
    });

    it('should buffer realname when user does not exist', () => {
      setUserRealnameExport('NewUser', 'Real Name');

      expect(getUser('NewUser')).toBeUndefined();
      expect(pendingMetadata.get('NewUser')).toEqual({ realname: 'Real Name' });
    });
  });

  describe('deduplication of metadata updates', () => {
    it('should not create new user reference when avatar is unchanged', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setUserAvatar('TestUser', 'https://avatar.png');
      const userAfterFirst = getUser('TestUser');

      useUsersStore.getState().setUserAvatar('TestUser', 'https://avatar.png');
      const userAfterSecond = getUser('TestUser');

      expect(userAfterFirst).toBe(userAfterSecond);
    });

    it('should not create new user reference when color is unchanged', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setUserColor('TestUser', '#ff0000');
      const userAfterFirst = getUser('TestUser');

      useUsersStore.getState().setUserColor('TestUser', '#ff0000');
      const userAfterSecond = getUser('TestUser');

      expect(userAfterFirst).toBe(userAfterSecond);
    });

    it('should not create new user reference when displayName is unchanged', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setUserDisplayName('TestUser', 'Display');
      const userAfterFirst = getUser('TestUser');

      useUsersStore.getState().setUserDisplayName('TestUser', 'Display');
      const userAfterSecond = getUser('TestUser');

      expect(userAfterFirst).toBe(userAfterSecond);
    });

    it('should not create new user reference when status is unchanged', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setUserStatus('TestUser', 'Away');
      const userAfterFirst = getUser('TestUser');

      useUsersStore.getState().setUserStatus('TestUser', 'Away');
      const userAfterSecond = getUser('TestUser');

      expect(userAfterFirst).toBe(userAfterSecond);
    });

    it('should not create new user reference when host is unchanged', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setUserHost('TestUser', 'ident', 'hostname');
      const userAfterFirst = getUser('TestUser');

      useUsersStore.getState().setUserHost('TestUser', 'ident', 'hostname');
      const userAfterSecond = getUser('TestUser');

      expect(userAfterFirst).toBe(userAfterSecond);
    });

    it('should create new user reference when value actually changes', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setUserAvatar('TestUser', 'https://old.png');
      const userAfterFirst = getUser('TestUser');

      useUsersStore.getState().setUserAvatar('TestUser', 'https://new.png');
      const userAfterSecond = getUser('TestUser');

      expect(userAfterFirst).not.toBe(userAfterSecond);
      expect(userAfterSecond?.avatar).toBe('https://new.png');
    });
  });

  describe('edge cases', () => {
    it('should handle renaming non-existent user gracefully', () => {
      useUsersStore.getState().setRenameUser('NonExistent', 'NewNick');

      expect(useUsersStore.getState().users.length).toBe(0);
    });

    it('should handle joining channel for non-existent user gracefully', () => {
      useUsersStore.getState().setJoinUser('NonExistent', '#channel1');

      expect(useUsersStore.getState().users.length).toBe(0);
    });

    it('should handle user with many channels correctly', () => {
      const channels = Array.from({ length: 50 }, (_, i) => ({
        name: `#channel${i}`,
        flags: [] as string[],
        maxPermission: -1,
      }));

      useUsersStore.getState().setAddUser(createUser('TestUser', channels));

      useUsersStore.getState().setRenameUser('TestUser', 'NewNick');

      const userChannels = getUserChannels('NewNick');
      expect(userChannels.length).toBe(50);
      expect(new Set(userChannels).size).toBe(50);
    });

    it('should handle empty nick gracefully', () => {
      useUsersStore.getState().setAddUser(createUser('', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      expect(getUser('')).toBeDefined();
    });
  });

  describe('limits', () => {
    it('should cap users at 50000 via setAddUser export', () => {
      // Pre-populate store directly to avoid overhead of 50k wrapper calls
      const users = Array.from({ length: 50_000 }, (_, i) => createUser(`User${i}`, [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));
      useUsersStore.setState({ users });

      // The next user via the exported wrapper should be rejected
      setAddUserExport(createUser('Overflow', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      expect(useUsersStore.getState().users.length).toBe(50_000);
      expect(getHasUser('Overflow')).toBe(false);
    });
  });
});
