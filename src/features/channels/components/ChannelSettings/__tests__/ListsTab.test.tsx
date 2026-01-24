import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ListsTab from '../tabs/ListsTab';
import * as network from '@/network/irc/network';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/network/irc/network', () => ({
  ircSendRawMessage: vi.fn(),
}));

vi.mock('@/shared/lib/dateLocale', async () => {
  const { enUS } = await import('date-fns/locale');
  return { getDateFnsLocale: () => enUS };
});

const mockBanList = [
  { mask: '*!*@bad.host', setBy: 'admin', setTime: 1705000000 },
  { mask: 'troll!*@*', setBy: 'mod', setTime: 1705100000 },
];

const mockExceptionList = [
  { mask: '*!*@good.host', setBy: 'admin', setTime: 1705000000 },
];

const mockInviteList = [
  { mask: '*!*@invited.host', setBy: 'owner', setTime: 1705000000 },
];

const mockSetActiveListType = vi.fn();

vi.mock('@features/channels/store/channelSettings', () => ({
  useChannelSettingsStore: vi.fn((selector) =>
    selector({
      activeListType: 'b',
      banList: mockBanList,
      exceptionList: mockExceptionList,
      inviteList: mockInviteList,
      isBanListLoading: false,
      isExceptionListLoading: false,
      isInviteListLoading: false,
      setActiveListType: mockSetActiveListType,
    })
  ),
}));

describe('ListsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render list type buttons', () => {
      render(<ListsTab channelName="#test" />);

      expect(screen.getByTestId('list-type-bans')).toBeInTheDocument();
      expect(screen.getByTestId('list-type-exceptions')).toBeInTheDocument();
      expect(screen.getByTestId('list-type-invites')).toBeInTheDocument();
    });

    it('should show ban count in button', () => {
      render(<ListsTab channelName="#test" />);

      expect(screen.getByTestId('list-type-bans')).toHaveTextContent('(2)');
    });

    it('should show exception count in button', () => {
      render(<ListsTab channelName="#test" />);

      expect(screen.getByTestId('list-type-exceptions')).toHaveTextContent('(1)');
    });

    it('should show invite count in button', () => {
      render(<ListsTab channelName="#test" />);

      expect(screen.getByTestId('list-type-invites')).toHaveTextContent('(1)');
    });

    it('should render table headers', () => {
      render(<ListsTab channelName="#test" />);

      expect(screen.getByText('channelSettings.lists.mask')).toBeInTheDocument();
      expect(screen.getByText('channelSettings.lists.setBy')).toBeInTheDocument();
      expect(screen.getByText('channelSettings.lists.date')).toBeInTheDocument();
    });

    it('should render ban list entries', () => {
      render(<ListsTab channelName="#test" />);

      expect(screen.getByText('*!*@bad.host')).toBeInTheDocument();
      expect(screen.getByText('troll!*@*')).toBeInTheDocument();
      expect(screen.getByText('admin')).toBeInTheDocument();
      expect(screen.getByText('mod')).toBeInTheDocument();
    });

    it('should render add entry input', () => {
      render(<ListsTab channelName="#test" />);

      expect(screen.getByTestId('new-entry-input')).toBeInTheDocument();
    });

    it('should render add button', () => {
      render(<ListsTab channelName="#test" />);

      expect(screen.getByTestId('add-entry')).toBeInTheDocument();
    });
  });

  describe('list type switching', () => {
    it('should call setActiveListType when clicking exceptions button', () => {
      render(<ListsTab channelName="#test" />);

      fireEvent.click(screen.getByTestId('list-type-exceptions'));

      expect(mockSetActiveListType).toHaveBeenCalledWith('e');
    });

    it('should call setActiveListType when clicking invites button', () => {
      render(<ListsTab channelName="#test" />);

      fireEvent.click(screen.getByTestId('list-type-invites'));

      expect(mockSetActiveListType).toHaveBeenCalledWith('I');
    });

    it('should call setActiveListType when clicking bans button', () => {
      render(<ListsTab channelName="#test" />);

      fireEvent.click(screen.getByTestId('list-type-bans'));

      expect(mockSetActiveListType).toHaveBeenCalledWith('b');
    });
  });

  describe('adding entries', () => {
    it('should send MODE +b command when adding ban', () => {
      render(<ListsTab channelName="#test" />);

      const input = screen.getByTestId('new-entry-input');
      fireEvent.change(input, { target: { value: '*!*@newban.host' } });
      fireEvent.click(screen.getByTestId('add-entry'));

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test +b *!*@newban.host');
    });

    it('should add entry when pressing Enter', () => {
      render(<ListsTab channelName="#test" />);

      const input = screen.getByTestId('new-entry-input');
      fireEvent.change(input, { target: { value: '*!*@enterban.host' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test +b *!*@enterban.host');
    });

    it('should clear input after adding entry', () => {
      render(<ListsTab channelName="#test" />);

      const input = screen.getByTestId('new-entry-input') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '*!*@newban.host' } });
      fireEvent.click(screen.getByTestId('add-entry'));

      expect(input.value).toBe('');
    });

    it('should not send command if input is empty', () => {
      render(<ListsTab channelName="#test" />);

      fireEvent.click(screen.getByTestId('add-entry'));

      expect(network.ircSendRawMessage).not.toHaveBeenCalled();
    });
  });

  describe('removing entries', () => {
    it('should send MODE -b command when removing ban', () => {
      render(<ListsTab channelName="#test" />);

      // List is sorted by setTime descending, so troll!*@* (newer) is first
      fireEvent.click(screen.getByTestId('remove-entry-0'));

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('MODE #test -b troll!*@*');
    });

    it('should render remove buttons for each entry', () => {
      render(<ListsTab channelName="#test" />);

      expect(screen.getByTestId('remove-entry-0')).toBeInTheDocument();
      expect(screen.getByTestId('remove-entry-1')).toBeInTheDocument();
    });
  });

});
