import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ReactionPicker, { type ReactionPickerHandle } from '../ReactionPicker';
import * as reactionsFile from '@features/reactions/reactions';
import * as channelsFile from '@features/channels/store/channels';
import * as settingsFile from '@features/settings/store/settings';
import { type Message, MessageCategory } from '@shared/types';

vi.mock('emoji-picker-react', () => ({
  default: ({ onReactionClick, onEmojiClick }: { onReactionClick: (emoji: { emoji: string }) => void; onEmojiClick: (emoji: { emoji: string }) => void }) => (
    <div>
      <button type="button" onClick={() => onReactionClick({ emoji: '👍' })}>quick 👍</button>
      <button type="button" onClick={() => onEmojiClick({ emoji: '🦀' })}>full 🦀</button>
    </div>
  ),
}));

const message = (overrides: Partial<Message> = {}): Message => ({
  id: 'm1',
  msgid: 'm1',
  message: 'hello',
  target: '#sic',
  time: '2026-10-23T10:00:00.000Z',
  category: MessageCategory.default,
  ...overrides,
});

describe('ReactionPicker', () => {
  let send: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    send = vi.spyOn(reactionsFile, 'sendReaction').mockImplementation(() => {});
    vi.spyOn(settingsFile, 'getCurrentNick').mockImplementation(() => 'me');
  });

  const open = (shown: Message): void => {
    vi.spyOn(channelsFile, 'getMessages').mockImplementation(() => [shown]);
    const ref = createRef<ReactionPickerHandle>();
    render(<ReactionPicker ref={ref} />);
    act(() => ref.current?.open(shown, document.body));
  };

  it('stays closed until opened at a message', () => {
    render(<ReactionPicker ref={createRef()} />);

    expect(screen.queryByText('quick 👍')).not.toBeInTheDocument();
  });

  it('reacts with a quick reaction and closes', async () => {
    open(message());

    fireEvent.click(await screen.findByText('quick 👍'));

    expect(send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 'm1' }), '👍', true);
    expect(screen.queryByText('quick 👍')).not.toBeInTheDocument();
  });

  it('reacts with any emoji from the full picker', async () => {
    open(message());

    fireEvent.click(await screen.findByText('full 🦀'));

    expect(send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 'm1' }), '🦀', true);
  });

  it('takes back a reaction we gave, going by the message as shown now', async () => {
    const opened = message();
    open(opened);
    vi.mocked(channelsFile.getMessages).mockImplementation(() => [message({ reactions: [{ emoji: '👍', nicks: ['Me'] }] })]);

    fireEvent.click(await screen.findByText('quick 👍'));

    expect(send).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ reactions: [{ emoji: '👍', nicks: ['Me'] }] }), '👍', false);
  });
});
