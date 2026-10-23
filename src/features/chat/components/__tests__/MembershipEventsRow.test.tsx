import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MembershipEventsRow from '../MembershipEventsRow';
import { MessageCategory, type Message } from '@shared/types';

const fold = (nick: string): string => nick.toLowerCase();

const joins = (...nicks: string[]): Message[] =>
  nicks.map((nick, index) => ({ id: `j${index}`, message: `${nick} has joined`, nick, target: '#c', time: '2026-10-24T12:00:00Z', category: MessageCategory.join }));

describe('MembershipEventsRow', () => {
  it('should list up to four names in full', () => {
    render(<MembershipEventsRow id="j0" events={joins('a', 'b', 'c', 'd')} expanded={false} onToggle={vi.fn()} fontSizeClass="" fold={fold} />);

    expect(screen.getByRole('button')).toHaveTextContent('Weszli: a, b, c, d');
  });

  it('should shorten a longer list to three names and a count', () => {
    render(<MembershipEventsRow id="j0" events={joins('a', 'b', 'c', 'd', 'e', 'f')} expanded={false} onToggle={vi.fn()} fontSizeClass="" fold={fold} />);

    expect(screen.getByRole('button')).toHaveTextContent('Weszli: a, b, c +3');
  });

  it('should toggle its run by id', () => {
    const onToggle = vi.fn();
    render(<MembershipEventsRow id="run-1" events={joins('a', 'b')} expanded onToggle={onToggle} fontSizeClass="" fold={fold} />);

    screen.getByRole('button', { expanded: true }).click();

    expect(onToggle).toHaveBeenCalledWith('run-1');
  });
});
