import { describe, it, expect, beforeEach } from 'vitest';
import { getFriendsForNetwork, isFriendOnNetwork, useFriendsStore } from '../friends';

describe('friends store', () => {
  beforeEach(() => {
    useFriendsStore.setState({ friendsByNetwork: {} });
  });

  describe('addFriend', () => {
    it('should add nick to the network friends list', () => {
      useFriendsStore.getState().addFriend('pirc.pl', 'Alice');

      expect(getFriendsForNetwork('pirc.pl')).toEqual(['Alice']);
      expect(isFriendOnNetwork('pirc.pl', 'Alice')).toBe(true);
    });

    it('should dedupe case-insensitively but keep display case', () => {
      useFriendsStore.getState().addFriend('pirc.pl', 'Alice');
      useFriendsStore.getState().addFriend('pirc.pl', 'ALICE');

      expect(getFriendsForNetwork('pirc.pl')).toEqual(['Alice']);
    });

    it('should keep networks isolated', () => {
      useFriendsStore.getState().addFriend('pirc.pl', 'Alice');
      useFriendsStore.getState().addFriend('Libera.Chat', 'Bob');

      expect(getFriendsForNetwork('pirc.pl')).toEqual(['Alice']);
      expect(getFriendsForNetwork('Libera.Chat')).toEqual(['Bob']);
      expect(isFriendOnNetwork('Libera.Chat', 'Alice')).toBe(false);
    });
  });

  describe('removeFriend', () => {
    it('should remove nick case-insensitively', () => {
      useFriendsStore.getState().addFriend('pirc.pl', 'Alice');
      useFriendsStore.getState().removeFriend('pirc.pl', 'alice');

      expect(getFriendsForNetwork('pirc.pl')).toEqual([]);
      expect(isFriendOnNetwork('pirc.pl', 'Alice')).toBe(false);
    });

    it('should drop the network entry when the last friend is removed', () => {
      useFriendsStore.getState().addFriend('pirc.pl', 'Alice');
      useFriendsStore.getState().removeFriend('pirc.pl', 'Alice');

      expect(useFriendsStore.getState().friendsByNetwork).toEqual({});
    });

    it('should handle removing from an unknown network', () => {
      useFriendsStore.getState().removeFriend('unknown', 'Alice');

      expect(useFriendsStore.getState().friendsByNetwork).toEqual({});
    });

    it('should not touch other friends', () => {
      useFriendsStore.getState().addFriend('pirc.pl', 'Alice');
      useFriendsStore.getState().addFriend('pirc.pl', 'Bob');
      useFriendsStore.getState().removeFriend('pirc.pl', 'Alice');

      expect(getFriendsForNetwork('pirc.pl')).toEqual(['Bob']);
    });
  });

  describe('renameFriend', () => {
    it('should rename in place, preserving list order', () => {
      useFriendsStore.getState().addFriend('pirc.pl', 'Alice');
      useFriendsStore.getState().addFriend('pirc.pl', 'Bob');
      useFriendsStore.getState().addFriend('pirc.pl', 'Carol');

      useFriendsStore.getState().renameFriend('pirc.pl', 'Bob', 'Bob2');

      expect(getFriendsForNetwork('pirc.pl')).toEqual(['Alice', 'Bob2', 'Carol']);
      expect(isFriendOnNetwork('pirc.pl', 'Bob')).toBe(false);
      expect(isFriendOnNetwork('pirc.pl', 'Bob2')).toBe(true);
    });

    it('should match the old nick case-insensitively', () => {
      useFriendsStore.getState().addFriend('pirc.pl', 'Alice');

      useFriendsStore.getState().renameFriend('pirc.pl', 'ALICE', 'Alicia');

      expect(getFriendsForNetwork('pirc.pl')).toEqual(['Alicia']);
    });

    it('should be a no-op when the nick is not a friend', () => {
      useFriendsStore.getState().addFriend('pirc.pl', 'Alice');

      useFriendsStore.getState().renameFriend('pirc.pl', 'Ghost', 'Ghost2');

      expect(getFriendsForNetwork('pirc.pl')).toEqual(['Alice']);
    });

    it('should be a no-op for an unknown network', () => {
      useFriendsStore.getState().renameFriend('unknown', 'Alice', 'Alicia');

      expect(useFriendsStore.getState().friendsByNetwork).toEqual({});
    });
  });
});
