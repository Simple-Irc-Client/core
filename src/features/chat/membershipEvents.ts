import { isSameDay } from 'date-fns';
import { getNickFromMessage } from '@shared/lib/displayName';
import { MessageCategory, type Message } from '@shared/types';

export type MembershipEventsDisplay = 'all' | 'collapse' | 'collapseHideIdle';

/** What people wrote, as opposed to events and server output */
export const contentCategories = new Set<MessageCategory>([MessageCategory.default, MessageCategory.me, MessageCategory.notice]);

/** Someone who wrote nothing this long before or after an event of theirs is idle for it */
export const IDLE_WINDOW_MS = 30 * 60 * 1000;

const membershipCategories = new Set<MessageCategory>([MessageCategory.join, MessageCategory.part, MessageCategory.quit]);

export type ChatItem = { kind: 'message'; message: Message } | { kind: 'events'; id: string; messages: Message[] };

interface CollapseOptions {
  display: MembershipEventsDisplay;
  /** The server's case folding, so nicks compare as it does */
  fold: (nick: string) => string;
  /** Our own events are never hidden */
  myNick: string;
}

const isMembershipEvent = (message: Message): boolean =>
  message.renamed !== undefined || (membershipCategories.has(message.category) && getNickFromMessage(message) !== undefined);

const eventNicks = (event: Message): string[] =>
  event.renamed === undefined ? [getNickFromMessage(event) ?? ''] : [event.renamed.from, event.renamed.to];

/** When each nick wrote something */
const activityTimes = (messages: Message[], fold: (nick: string) => string): Map<string, number[]> => {
  const times = new Map<string, number[]>();
  for (const message of messages) {
    const nick = getNickFromMessage(message);
    if (nick !== undefined && contentCategories.has(message.category)) {
      const key = fold(nick);
      times.set(key, [...(times.get(key) ?? []), Date.parse(message.time)]);
    }
  }
  return times;
};

/**
 * Joins, parts, quits and nick changes in a row (on one day) become one `events` item; a lone one stays a message.
 * `collapseHideIdle` first drops the events of people who wrote nothing near them.
 */
export const collapseMembershipEvents = (messages: Message[], { display, fold, myNick }: CollapseOptions): ChatItem[] => {
  if (display === 'all') {
    return messages.map((message) => ({ kind: 'message', message }));
  }

  const activity = display === 'collapseHideIdle' ? activityTimes(messages, fold) : undefined;
  const isShown = (event: Message): boolean => {
    if (activity === undefined) {
      return true;
    }
    const time = Date.parse(event.time);
    return eventNicks(event).some((nick) =>
      fold(nick) === fold(myNick) || (activity.get(fold(nick)) ?? []).some((at) => Math.abs(at - time) <= IDLE_WINDOW_MS),
    );
  };

  const items: ChatItem[] = [];
  let run: Message[] = [];
  const endRun = (): void => {
    const [first] = run;
    const shown = run.filter(isShown);
    if (shown.length === 1 && shown[0] !== undefined) {
      items.push({ kind: 'message', message: shown[0] });
    } else if (shown.length > 1 && first !== undefined) {
      // Keyed by the run's first event, which stays its first as more come in
      items.push({ kind: 'events', id: first.id, messages: shown });
    }
    run = [];
  };

  for (const message of messages) {
    if (!isMembershipEvent(message)) {
      endRun();
      items.push({ kind: 'message', message });
      continue;
    }
    const [first] = run;
    if (first !== undefined && !isSameDay(new Date(first.time), new Date(message.time))) {
      endRun();
    }
    run.push(message);
  }
  endRun();
  return items;
};

export interface EventsSummary {
  joined: string[];
  left: string[];
  /** Came and went within the run */
  joinedAndLeft: string[];
  /** Went and came back within the run */
  rejoined: string[];
  renamed: { from: string; to: string }[];
}

/** Who did what in a run, each person once under the nick they ended it with */
export const summarizeEvents = (events: Message[], fold: (nick: string) => string): EventsSummary => {
  const people: { firstNick: string; nick: string; actions: ('join' | 'leave')[] }[] = [];
  const byNick = new Map<string, (typeof people)[number]>();
  const personFor = (nick: string): (typeof people)[number] => {
    const known = byNick.get(fold(nick));
    if (known !== undefined) {
      return known;
    }
    const person = { firstNick: nick, nick, actions: [] };
    byNick.set(fold(nick), person);
    people.push(person);
    return person;
  };

  for (const event of events) {
    if (event.renamed !== undefined) {
      const person = personFor(event.renamed.from);
      byNick.delete(fold(event.renamed.from));
      person.nick = event.renamed.to;
      byNick.set(fold(event.renamed.to), person);
      continue;
    }
    personFor(getNickFromMessage(event) ?? '').actions.push(event.category === MessageCategory.join ? 'join' : 'leave');
  }

  const summary: EventsSummary = { joined: [], left: [], joinedAndLeft: [], rejoined: [], renamed: [] };
  for (const { firstNick, nick, actions } of people) {
    if (fold(firstNick) !== fold(nick)) {
      summary.renamed.push({ from: firstNick, to: nick });
    }
    const [first] = actions;
    const last = actions.at(-1);
    if (first === 'join') {
      (last === 'join' ? summary.joined : summary.joinedAndLeft).push(nick);
    } else if (first === 'leave') {
      (last === 'leave' ? summary.left : summary.rejoined).push(nick);
    }
  }
  return summary;
};
