import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Friends from '../Friends';
import * as settingsStore from '@features/settings/store/settings';
import * as channelsStore from '@features/channels/store/channels';
import * as friendsActions from '@features/friends/friends';
import * as DrawersContext from '@/providers/DrawersContext';
import { useFriendsStore } from '@features/friends/store/friends';
import { useMonitorStore } from '@features/monitor/store/monitor';
import { ChannelCategory } from '@shared/types';

// Spread the actual module: the friends actions module transitively pulls in
// app i18n, which needs the real initReactI18next.
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  };
});

vi.mock('@features/friends/friends', () => ({
  addFriend: vi.fn(() => true),
  removeFriend: vi.fn(),
}));

// Plain-div dialog shell that respects `open`, so the add-friend flow can be
// exercised without Radix portal/animation machinery in jsdom.
vi.mock('@shared/components/ui/dialog', () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Dialog: ({ open, children }: { open: boolean; children?: React.ReactNode }) => (open ? <div>{children}</div> : null),
    DialogContent: ({ children }: { children?: React.ReactNode }) => <div data-testid="dialog-content">{children}</div>,
    DialogHeader: passthrough,
    DialogTitle: passthrough,
    DialogDescription: passthrough,
    DialogFooter: passthrough,
  };
});

const setMonitorOnline = (nick: string): void => {
  useMonitorStore.getState().setOnlineStatus(nick, true);
};

describe('Friends', () => {
  const mockSetCurrentChannelName = vi.fn();
  const mockSetAddChannel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useFriendsStore.setState({ friendsByNetwork: {} });
    useMonitorStore.getState().clearAll();

    vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
      selector({
        server: { network: 'pirc.pl' },
        currentChannelName: '#test',
      } as unknown as settingsStore.SettingsStore)
    );
    vi.spyOn(settingsStore, 'setCurrentChannelName').mockImplementation(mockSetCurrentChannelName);
    vi.spyOn(channelsStore, 'setAddChannel').mockImplementation(mockSetAddChannel);
    vi.spyOn(DrawersContext, 'useChannelsDrawer').mockReturnValue({
      isChannelsDrawerOpen: false,
      setChannelsDrawerStatus: vi.fn(),
    });
  });

  it('renders nothing when no server is configured', () => {
    vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
      selector({ server: undefined, currentChannelName: '#test' } as unknown as settingsStore.SettingsStore)
    );

    render(<Friends fontSizeClass="text-sm" />);

    expect(screen.queryByTestId('friends-section')).toBeNull();
  });

  it('renders friends of the current network, online first', () => {
    useFriendsStore.setState({
      friendsByNetwork: {
        'pirc.pl': ['Adam', 'Zenon'],
        'Libera.Chat': ['Other'],
      },
    });
    setMonitorOnline('Zenon');

    render(<Friends fontSizeClass="text-sm" />);

    const buttons = screen.getAllByRole('button').filter((b) => ['Adam', 'Zenon', 'Other'].includes(b.getAttribute('aria-label') ?? ''));
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual(['Zenon', 'Adam']);
    expect(screen.getByLabelText('main.friends.online')).toBeTruthy();
    expect(screen.getByLabelText('main.friends.offline')).toBeTruthy();
  });

  it('opens a private conversation when a friend is clicked', () => {
    useFriendsStore.setState({ friendsByNetwork: { 'pirc.pl': ['Alice'] } });

    render(<Friends fontSizeClass="text-sm" />);
    fireEvent.click(screen.getByRole('button', { name: 'Alice' }));

    expect(mockSetAddChannel).toHaveBeenCalledWith('Alice', ChannelCategory.priv);
    expect(mockSetCurrentChannelName).toHaveBeenCalledWith('Alice', ChannelCategory.priv);
  });

  it('removes a friend via the hover button', () => {
    useFriendsStore.setState({ friendsByNetwork: { 'pirc.pl': ['Alice'] } });

    render(<Friends fontSizeClass="text-sm" />);
    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Alice' }).parentElement as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: 'main.friends.remove' }));

    expect(friendsActions.removeFriend).toHaveBeenCalledWith('Alice');
  });

  it('adds a friend through the dialog', () => {
    render(<Friends fontSizeClass="text-sm" />);

    expect(screen.queryByTestId('dialog-content')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'main.friends.add' }));
    expect(screen.getByTestId('dialog-content')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('main.friends.addDialog.placeholder'), { target: { value: 'NewFriend' } });
    fireEvent.click(screen.getByRole('button', { name: 'main.friends.addDialog.confirm' }));

    expect(friendsActions.addFriend).toHaveBeenCalledWith('NewFriend');
    // Dialog closes after a successful add
    expect(screen.queryByTestId('dialog-content')).toBeNull();
  });

  it('shows a validation error when the nick is rejected', () => {
    vi.mocked(friendsActions.addFriend).mockReturnValue(false);

    render(<Friends fontSizeClass="text-sm" />);
    fireEvent.click(screen.getByRole('button', { name: 'main.friends.add' }));
    fireEvent.change(screen.getByLabelText('main.friends.addDialog.placeholder'), { target: { value: 'bad nick' } });
    fireEvent.click(screen.getByRole('button', { name: 'main.friends.addDialog.confirm' }));

    expect(screen.getByRole('alert').textContent).toBe('main.friends.addDialog.invalidNick');
    expect(screen.getByTestId('dialog-content')).toBeTruthy();
  });
});
