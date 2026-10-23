import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import MessageReactions from '../MessageReactions';
import * as reactionsFile from '@features/reactions/reactions';
import { useSettingsStore } from '@features/settings/store/settings';
import { type Message, MessageCategory } from '@shared/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) => (values ? `${key} ${values.emoji} ${values.nicks}` : key),
  }),
}));

vi.mock('@/network/irc/network', () => ({
  ircSendRawMessage: vi.fn(),
}));

const message: Message = {
  id: 'm1',
  msgid: 'm1',
  message: 'hello',
  target: '#sic',
  time: '2026-10-23T10:00:00.000Z',
  category: MessageCategory.default,
  reactions: [
    { emoji: '👍', nicks: ['alice', 'Me'] },
    { emoji: '😂', nicks: ['bob'] },
  ],
};

describe('MessageReactions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useSettingsStore.setState({ nick: 'me' });
  });

  it('shows each reaction with its count and who gave it', () => {
    render(<MessageReactions message={message} canReact />);

    const thumbs = screen.getByRole('button', { name: 'main.chat.reaction 👍 alice, Me' });
    expect(thumbs).toHaveTextContent('👍2');
    expect(thumbs).toHaveAttribute('title', 'alice, Me');
    expect(screen.getByRole('button', { name: 'main.chat.reaction 😂 bob' })).toHaveTextContent('😂1');
  });

  it('marks the reactions we gave', () => {
    render(<MessageReactions message={message} canReact />);

    expect(screen.getByRole('button', { name: /👍/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /😂/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('takes our reaction back, or joins one, on click', () => {
    const send = vi.spyOn(reactionsFile, 'sendReaction').mockImplementation(() => {});
    render(<MessageReactions message={message} canReact />);

    fireEvent.click(screen.getByRole('button', { name: /👍/ }));
    fireEvent.click(screen.getByRole('button', { name: /😂/ }));

    expect(send).toHaveBeenNthCalledWith(1, message, '👍', false);
    expect(send).toHaveBeenNthCalledWith(2, message, '😂', true);
  });

  it('only shows them where reactions cannot be sent', () => {
    const send = vi.spyOn(reactionsFile, 'sendReaction').mockImplementation(() => {});
    render(<MessageReactions message={message} canReact={false} />);

    const thumbs = screen.getByRole('button', { name: /👍/ });
    expect(thumbs).toBeDisabled();
    fireEvent.click(thumbs);
    expect(send).not.toHaveBeenCalled();
  });
});
