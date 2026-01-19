import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  useUsersStore,
  getUserChannels,
  getUser,
  getHasUser,
  getUsersFromChannelSortedByMode,
  getUsersFromChannelSortedByAZ,
  getCurrentUserChannelModes,
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
        avatar: 'http://example.com/avatar.png',
        color: '#ff0000',
        channels: [{ name: '#channel1', flags: ['o'], maxPermission: 3 }],
      };

      useUsersStore.getState().setAddUser(user);

      const storedUser = useUsersStore.getState().users[0];
      expect(storedUser?.nick).toBe('TestUser');
      expect(storedUser?.ident).toBe('testident');
      expect(storedUser?.hostname).toBe('test.host.com');
      expect(storedUser?.flags).toEqual(['away']);
      expect(storedUser?.avatar).toBe('http://example.com/avatar.png');
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
  });

  describe('setUserAvatar', () => {
    it('should set avatar for user', () => {
      useUsersStore.getState().setAddUser(createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setUserAvatar('TestUser', 'http://example.com/avatar.png');

      expect(getUser('TestUser')?.avatar).toBe('http://example.com/avatar.png');
    });

    it('should update existing avatar', () => {
      const user = createUser('TestUser', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]);
      user.avatar = 'http://old-avatar.png';
      useUsersStore.getState().setAddUser(user);

      useUsersStore.getState().setUserAvatar('TestUser', 'http://new-avatar.png');

      expect(getUser('TestUser')?.avatar).toBe('http://new-avatar.png');
    });

    it('should not affect other users', () => {
      useUsersStore.getState().setAddUser(createUser('User1', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));
      useUsersStore.getState().setAddUser(createUser('User2', [
        { name: '#channel1', flags: [], maxPermission: -1 },
      ]));

      useUsersStore.getState().setUserAvatar('User1', 'http://avatar.png');

      expect(getUser('User1')?.avatar).toBe('http://avatar.png');
      expect(getUser('User2')?.avatar).toBeUndefined();
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
      useUsersStore.getState().setUserAvatar('TestUser', 'http://example.com/avatar.png');
      const userAfter = useUsersStore.getState().users[0];

      expect(userBefore).not.toBe(userAfter);
      expect(userBefore?.avatar).toBeUndefined();
      expect(userAfter?.avatar).toBe('http://example.com/avatar.png');
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
});
