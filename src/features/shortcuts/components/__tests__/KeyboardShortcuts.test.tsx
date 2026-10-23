import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import KeyboardShortcuts from '../KeyboardShortcuts';
import { useShortcutsStore } from '../../store/shortcuts';
import { useChannelsStore } from '@features/channels/store/channels';
import { useSettingsStore } from '@features/settings/store/settings';
import { ChannelCategory } from '@shared/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/app/i18n', () => ({
  default: {},
}));

// cmdk measures its list and scrolls the selected item into view, which jsdom lacks
beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = vi.fn();
});

const itemNames = (): string[] =>
  within(screen.getByTestId('quick-switcher'))
    .getAllByRole('option')
    .map((option) => option.textContent ?? '');

describe('KeyboardShortcuts', () => {
  beforeEach(() => {
    useShortcutsStore.setState({ openDialog: null });
    useSettingsStore.setState({ currentChannelName: '#home', currentChannelCategory: ChannelCategory.channel });
    useChannelsStore.setState({
      openChannelsShortList: [
        { name: 'Status', category: ChannelCategory.status, unReadMessages: 0 },
        { name: '#home', category: ChannelCategory.channel, unReadMessages: 0 },
        { name: '#rust', category: ChannelCategory.channel, unReadMessages: 0 },
        { name: '#random', category: ChannelCategory.channel, unReadMessages: 4 },
        { name: 'alice', category: ChannelCategory.priv, unReadMessages: 2, hasMention: true },
      ],
    });
  });

  it('should open the switcher with Ctrl+K, most urgent windows first', async () => {
    const user = userEvent.setup();
    render(<KeyboardShortcuts />);

    await user.keyboard('{Control>}k{/Control}');

    expect(itemNames()).toEqual(['alice2', '#random4', 'Status', '#rust', '#home']);
  });

  it('should switch to the window picked by typing part of its name', async () => {
    const user = userEvent.setup();
    render(<KeyboardShortcuts />);

    await user.keyboard('{Meta>}k{/Meta}');
    await user.keyboard('rus{Enter}');

    expect(useSettingsStore.getState().currentChannelName).toBe('#rust');
    expect(useSettingsStore.getState().currentChannelCategory).toBe(ChannelCategory.channel);
    expect(screen.queryByTestId('quick-switcher')).not.toBeInTheDocument();
  });

  it('should switch to a conversation clicked in the list', async () => {
    const user = userEvent.setup();
    render(<KeyboardShortcuts />);

    await user.keyboard('{Control>}k{/Control}');
    await user.click(screen.getByRole('option', { name: /alice/ }));

    expect(useSettingsStore.getState().currentChannelName).toBe('alice');
    expect(useSettingsStore.getState().currentChannelCategory).toBe(ChannelCategory.priv);
  });

  it('should say when nothing matches, and stay on the current window', async () => {
    const user = userEvent.setup();
    render(<KeyboardShortcuts />);

    await user.keyboard('{Control>}k{/Control}');
    await user.keyboard('zzz{Enter}');

    expect(screen.getByText('shortcuts.switcher.empty')).toBeInTheDocument();
    expect(useSettingsStore.getState().currentChannelName).toBe('#home');
  });

  it('should close the switcher with the same shortcut, or Escape', async () => {
    const user = userEvent.setup();
    render(<KeyboardShortcuts />);

    await user.keyboard('{Control>}k{/Control}');
    await user.keyboard('{Control>}k{/Control}');
    expect(screen.queryByTestId('quick-switcher')).not.toBeInTheDocument();

    await user.keyboard('{Control>}k{/Control}');
    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('quick-switcher')).not.toBeInTheDocument();
    expect(useShortcutsStore.getState().openDialog).toBeNull();
  });

  it('should show the shortcuts list with Ctrl+/, or from the store', async () => {
    const user = userEvent.setup();
    render(<KeyboardShortcuts />);

    await user.keyboard('{Control>}/{/Control}');
    expect(screen.getByTestId('shortcuts-list')).toHaveTextContent('shortcuts.help.switcher');

    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('shortcuts-list')).not.toBeInTheDocument();

    act(() => {
      useShortcutsStore.getState().setOpenDialog('help');
    });
    expect(screen.getByTestId('shortcuts-list')).toBeInTheDocument();
  });

  it('should leave other keys alone', async () => {
    const user = userEvent.setup();
    render(<KeyboardShortcuts />);

    await user.keyboard('k{Control>}j{/Control}');

    expect(useShortcutsStore.getState().openDialog).toBeNull();
  });
});
