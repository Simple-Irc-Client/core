import { useMemo, useRef } from 'react';
import { ChannelCategory, type User } from '@shared/types';
import { channelCommands, generalCommands } from '@/network/irc/command';
import { getChannelListSortedByAZ } from '@features/channels/store/channelList';
import { useActiveUsers } from '@features/users/store/users';
import { isSameName } from '@features/networks/store/networks';

/** The word being typed: everything after the last whitespace */
const lastWord = (text: string): string => /\S*$/.exec(text)?.[0] ?? '';

const byLowerCase = (a: string, b: string): number => {
  const A = a.toLowerCase();
  const B = b.toLowerCase();
  return A < B ? -1 : A > B ? 1 : 0;
};

interface Autocomplete {
  /** The text typed, which Tab completes; keys that complete or step through history leave it as it was */
  noteTyped: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  complete: () => void;
  /** Any other key: the next Tab starts from the first match again */
  restart: () => void;
}

/** Tab completes the word being typed: a command after '/', a channel after '#', otherwise someone in the window; again for the next match */
export const useAutocomplete = (channelName: string, channelCategory: ChannelCategory, setMessage: (text: string) => void): Autocomplete => {
  const typed = useRef('');
  const matchIndex = useRef(-1);

  const commands = useMemo(() => {
    const available = channelCategory === ChannelCategory.channel || channelCategory === ChannelCategory.priv ? generalCommands.concat(channelCommands) : generalCommands;
    return [...available].sort(byLowerCase);
  }, [channelCategory]);

  const channels = useMemo(() => getChannelListSortedByAZ(), []);

  const allUsers = useActiveUsers((slice) => slice.users);
  const users = useMemo(
    () =>
      allUsers
        .filter((user: User) => user.channels.some((channel) => isSameName(channel.name, channelName)))
        .sort((a: User, b: User) => byLowerCase(a.nick, b.nick)),
    [allUsers, channelName]
  );

  const noteTyped = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    switch (event.key) {
      case 'Tab':
      case 'Up':
      case 'ArrowUp':
      case 'Down':
      case 'ArrowDown':
        return;
      default:
        typed.current = event.currentTarget.value;
        break;
    }
  };

  /** Replaces the last word with the next name after the previous match that starts with it */
  const completeFrom = (word: string, names: string[]): boolean => {
    for (const [index, name] of names.entries()) {
      if (name.toLowerCase().startsWith(word) && index > matchIndex.current) {
        matchIndex.current = index;

        const text = typed.current;
        setMessage(`${text.slice(0, text.length - lastWord(text).length)}${name} `);

        return true;
      }
    }
    return false;
  };

  const complete = (): void => {
    const word = lastWord(typed.current).toLowerCase();
    if (word.length === 0) {
      return;
    }

    let names: string[];
    if (word.startsWith('/')) {
      names = commands;
    } else if (word.startsWith('#')) {
      names = channels.map((channel) => channel.name);
    } else {
      names = users.map((user) => user.nick);
    }

    if (!completeFrom(word, names)) {
      // Past the last match: wrap around to the first
      matchIndex.current = -1;
      completeFrom(word, names);
    }
  };

  const restart = (): void => {
    matchIndex.current = -1;
  };

  return { noteTyped, complete, restart };
};
