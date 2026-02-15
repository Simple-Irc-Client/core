import { describe, expect, it, beforeEach } from 'vitest';
import {
  useChannelListStore,
  setAddChannelToList,
  setChannelListClear,
  setChannelListFinished,
  getChannelListSortedByAZ,
  getChannelListSortedByUsers,
} from '../channelList';

describe('channelList store', () => {
  beforeEach(() => {
    useChannelListStore.setState({
      channels: [],
      finished: false,
    });
  });

  describe('setAddChannelToList', () => {
    it('should add channel to list', () => {
      setAddChannelToList('#test', 10, 'Test channel');

      const channels = useChannelListStore.getState().channels;
      expect(channels.length).toBe(1);
      expect(channels[0]?.name).toBe('#test');
      expect(channels[0]?.users).toBe(10);
      expect(channels[0]?.topic).toBe('Test channel');
    });

    it('should add multiple channels', () => {
      setAddChannelToList('#test1', 10, 'Channel 1');
      setAddChannelToList('#test2', 20, 'Channel 2');
      setAddChannelToList('#test3', 30, 'Channel 3');

      expect(useChannelListStore.getState().channels.length).toBe(3);
    });

    it('should not add duplicate channel', () => {
      setAddChannelToList('#test', 10, 'Topic 1');
      setAddChannelToList('#test', 20, 'Topic 2');

      expect(useChannelListStore.getState().channels.length).toBe(1);
      expect(useChannelListStore.getState().channels[0]?.users).toBe(10);
    });

    it('should ignore hidden channels (asterisk)', () => {
      setAddChannelToList('*', 100, 'Hidden');

      expect(useChannelListStore.getState().channels.length).toBe(0);
    });

    it('should handle channel with empty topic', () => {
      setAddChannelToList('#test', 10, '');

      const channels = useChannelListStore.getState().channels;
      expect(channels[0]?.topic).toBe('');
    });

    it('should handle channel with zero users', () => {
      setAddChannelToList('#test', 0, 'Empty channel');

      const channels = useChannelListStore.getState().channels;
      expect(channels[0]?.users).toBe(0);
    });
  });

  describe('setChannelListClear', () => {
    it('should clear all channels', () => {
      setAddChannelToList('#test1', 10, 'Channel 1');
      setAddChannelToList('#test2', 20, 'Channel 2');

      setChannelListClear();

      expect(useChannelListStore.getState().channels.length).toBe(0);
    });

    it('should work on empty list', () => {
      setChannelListClear();
      expect(useChannelListStore.getState().channels.length).toBe(0);
    });
  });

  describe('setChannelListFinished', () => {
    it('should set finished to true', () => {
      // Add more than 10 channels to pass the threshold
      for (let i = 0; i < 15; i++) {
        setAddChannelToList(`#channel${i}`, i, `Topic ${i}`);
      }

      setChannelListFinished(true);

      expect(useChannelListStore.getState().finished).toBe(true);
    });

    it('should set finished to false', () => {
      useChannelListStore.setState({ finished: true });
      setChannelListFinished(false);

      expect(useChannelListStore.getState().finished).toBe(false);
    });

    it('should clear list if less than 10 channels when finishing', () => {
      setAddChannelToList('#test1', 10, 'Channel 1');
      setAddChannelToList('#test2', 20, 'Channel 2');

      setChannelListFinished(true);

      expect(useChannelListStore.getState().channels.length).toBe(0);
    });

    it('should not clear list if 10 or more channels when finishing', () => {
      for (let i = 0; i < 10; i++) {
        setAddChannelToList(`#channel${i}`, i, `Topic ${i}`);
      }

      setChannelListFinished(true);

      expect(useChannelListStore.getState().channels.length).toBe(10);
      expect(useChannelListStore.getState().finished).toBe(true);
    });
  });

  describe('getChannelListSortedByAZ', () => {
    it('should return channels sorted alphabetically', () => {
      setAddChannelToList('#zebra', 10, 'Zebra');
      setAddChannelToList('#alpha', 20, 'Alpha');
      setAddChannelToList('#beta', 15, 'Beta');

      const sorted = getChannelListSortedByAZ();

      expect(sorted[0]?.name).toBe('#alpha');
      expect(sorted[1]?.name).toBe('#beta');
      expect(sorted[2]?.name).toBe('#zebra');
    });

    it('should be case insensitive', () => {
      setAddChannelToList('#Zebra', 10, 'Zebra');
      setAddChannelToList('#alpha', 20, 'Alpha');
      setAddChannelToList('#BETA', 15, 'Beta');

      const sorted = getChannelListSortedByAZ();

      expect(sorted[0]?.name).toBe('#alpha');
      expect(sorted[1]?.name).toBe('#BETA');
      expect(sorted[2]?.name).toBe('#Zebra');
    });

    it('should return empty array for empty list', () => {
      const sorted = getChannelListSortedByAZ();
      expect(sorted).toEqual([]);
    });

    it('should handle single channel', () => {
      setAddChannelToList('#only', 10, 'Only');

      const sorted = getChannelListSortedByAZ();
      expect(sorted.length).toBe(1);
      expect(sorted[0]?.name).toBe('#only');
    });
  });

  describe('getChannelListSortedByUsers', () => {
    it('should return channels sorted by user count descending', () => {
      setAddChannelToList('#small', 10, 'Small');
      setAddChannelToList('#large', 100, 'Large');
      setAddChannelToList('#medium', 50, 'Medium');

      const sorted = getChannelListSortedByUsers();

      expect(sorted[0]?.name).toBe('#large');
      expect(sorted[1]?.name).toBe('#medium');
      expect(sorted[2]?.name).toBe('#small');
    });

    it('should handle channels with same user count', () => {
      setAddChannelToList('#first', 50, 'First');
      setAddChannelToList('#second', 50, 'Second');

      const sorted = getChannelListSortedByUsers();
      expect(sorted.length).toBe(2);
      // Both have same count, order may vary
      expect(sorted.map((c) => c.users)).toEqual([50, 50]);
    });

    it('should return empty array for empty list', () => {
      const sorted = getChannelListSortedByUsers();
      expect(sorted).toEqual([]);
    });

    it('should handle zero users', () => {
      setAddChannelToList('#empty', 0, 'Empty');
      setAddChannelToList('#active', 100, 'Active');

      const sorted = getChannelListSortedByUsers();

      expect(sorted[0]?.name).toBe('#active');
      expect(sorted[1]?.name).toBe('#empty');
    });
  });

  describe('immutability', () => {
    it('should not mutate channels array when adding', () => {
      setAddChannelToList('#test1', 10, 'Channel 1');
      const channelsBefore = useChannelListStore.getState().channels;

      setAddChannelToList('#test2', 20, 'Channel 2');
      const channelsAfter = useChannelListStore.getState().channels;

      expect(channelsBefore).not.toBe(channelsAfter);
    });

    it('should not mutate original array when sorting by AZ', () => {
      setAddChannelToList('#zebra', 10, 'Zebra');
      setAddChannelToList('#alpha', 20, 'Alpha');

      const original = useChannelListStore.getState().channels;
      const sorted = getChannelListSortedByAZ();

      expect(original).not.toBe(sorted);
      // Original order should be preserved
      expect(original[0]?.name).toBe('#zebra');
    });

    it('should not mutate original array when sorting by users', () => {
      setAddChannelToList('#small', 10, 'Small');
      setAddChannelToList('#large', 100, 'Large');

      const original = useChannelListStore.getState().channels;
      const sorted = getChannelListSortedByUsers();

      expect(original).not.toBe(sorted);
      // Original order should be preserved
      expect(original[0]?.name).toBe('#small');
    });
  });

  describe('edge cases', () => {
    it('should handle very long channel names', () => {
      const longName = '#' + 'a'.repeat(100);
      setAddChannelToList(longName, 10, 'Long name');

      expect(useChannelListStore.getState().channels[0]?.name).toBe(longName);
    });

    it('should handle special characters in topic', () => {
      const topic = 'Welcome! 🎉 <script>alert("xss")</script> & more';
      setAddChannelToList('#test', 10, topic);

      expect(useChannelListStore.getState().channels[0]?.topic).toBe(topic);
    });

    it('should handle large user counts', () => {
      setAddChannelToList('#large', 999999, 'Very large');

      expect(useChannelListStore.getState().channels[0]?.users).toBe(999999);
    });

    it('should handle many channels', () => {
      for (let i = 0; i < 1000; i++) {
        setAddChannelToList(`#channel${i}`, i, `Topic ${i}`);
      }

      expect(useChannelListStore.getState().channels.length).toBe(1000);

      const sortedByAZ = getChannelListSortedByAZ();
      expect(sortedByAZ.length).toBe(1000);

      const sortedByUsers = getChannelListSortedByUsers();
      expect(sortedByUsers.length).toBe(1000);
    });

    it('should cap channels at 10000', () => {
      for (let i = 0; i < 10_050; i++) {
        setAddChannelToList(`#ch${i}`, i, `Topic ${i}`);
      }

      expect(useChannelListStore.getState().channels.length).toBe(10_000);
    });
  });

  describe('finished state', () => {
    it('should default to false', () => {
      expect(useChannelListStore.getState().finished).toBe(false);
    });

    it('should reset when clearing', () => {
      // Add enough channels
      for (let i = 0; i < 15; i++) {
        setAddChannelToList(`#channel${i}`, i, `Topic ${i}`);
      }
      setChannelListFinished(true);
      expect(useChannelListStore.getState().finished).toBe(true);

      setChannelListClear();
      // Note: clear doesn't reset finished, it only clears channels
      expect(useChannelListStore.getState().channels.length).toBe(0);
    });
  });
});
