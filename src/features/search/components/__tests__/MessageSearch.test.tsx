import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MessageSearch from '../MessageSearch';
import { useChannelsStore } from '@features/channels/store/channels';
import { useGoToMessageStore } from '@features/chat/store/goToMessage';
import { useSettingsStore } from '@features/settings/store/settings';
import { applySpoilerMarkup } from '@features/chat/spoilers';
import { ChannelCategory, MessageCategory, type ChannelExtended, type Message } from '@shared/types';
import { setTestSession, setTestSlice } from '@/test/networks';
import { getActiveSession } from '@features/networks/store/networks';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key) }),
}));

vi.mock('@/app/i18n', () => ({
  default: {},
}));

vi.mock('@/shared/lib/dateLocale', async () => {
  const { enUS } = await import('date-fns/locale');
  return { getDateFnsLocale: () => enUS };
});

// cmdk measures its list and scrolls the selected item into view, which jsdom lacks
beforeAll(() => {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = vi.fn();
});

const message = (id: string, text: string, fields: Partial<Message> = {}): Message => ({
  id,
  message: text,
  target: '#chan',
  time: '2024-01-01T12:00:00Z',
  category: MessageCategory.default,
  ...fields,
});

const channel = (name: string, category: ChannelCategory, messages: Message[]): ChannelExtended => ({
  name,
  category,
  unReadMessages: 0,
  messages,
  topic: '',
  topicSetBy: '',
  topicSetTime: 0,
  typing: [],
});

const options = () => within(screen.getByTestId('message-search')).queryAllByRole('option');

const renderSearch = () => {
  const onOpenChange = vi.fn();
  render(<MessageSearch open onOpenChange={onOpenChange} />);
  return { onOpenChange, input: screen.getByRole('combobox', { name: 'search.title' }) };
};

describe('MessageSearch', () => {
  beforeEach(() => {
    useGoToMessageStore.setState({ sought: undefined });
    useSettingsStore.setState({ timeFormat: '24h', showSeconds: false });
    setTestSession({ currentChannelName: '#home', currentChannelCategory: ChannelCategory.channel });
    setTestSlice(useChannelsStore, {
      openChannels: [
        channel('#home', ChannelCategory.channel, [
          message('h1', 'the deploy went fine', { nick: 'bob', time: new Date(2024, 0, 1, 9, 30).toISOString() }),
        ]),
        channel('alice', ChannelCategory.priv, [
          message('a1', 'did the Deploy break?', { nick: 'alice', time: new Date(2024, 0, 2, 14, 5).toISOString() }),
          message('a2', 'never mind', { nick: 'alice', time: new Date(2024, 0, 2, 14, 6).toISOString() }),
        ]),
      ],
    });
  });

  it('should ask for something to search before listing anything', () => {
    renderSearch();

    expect(screen.getByText('search.hint')).toBeInTheDocument();
    expect(options()).toHaveLength(0);
  });

  it('should list the matching messages newest first, with their window, nick and date, the match marked', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.type(input, 'deploy');

    expect(options().map((option) => option.textContent)).toEqual([
      'alicealice01/02/2024 14:05did the Deploy break?',
      '#homebob01/01/2024 09:30the deploy went fine',
    ]);
    expect([...screen.getByTestId('message-search').querySelectorAll('mark')].map((mark) => mark.textContent)).toEqual(['Deploy', 'deploy']);
  });

  it('should show the date and time in the user\'s format', async () => {
    useSettingsStore.setState({ timeFormat: '12h', showSeconds: true });
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.type(input, 'break');

    expect(options()[0]).toHaveTextContent('01/02/2024 2:05:00 PM');
  });

  it('should go to the message picked, and close', async () => {
    const user = userEvent.setup();
    const { input, onOpenChange } = renderSearch();

    await user.type(input, 'deploy');
    await user.click(options()[1] as HTMLElement);

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(getActiveSession().currentChannelName).toBe('#home');
    expect(useGoToMessageStore.getState().sought).toEqual({ channelName: '#home', messageId: 'h1' });
  });

  it('should go to the first match with Enter', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.type(input, 'deploy{Enter}');

    expect(getActiveSession().currentChannelName).toBe('alice');
    expect(getActiveSession().currentChannelCategory).toBe(ChannelCategory.priv);
    expect(useGoToMessageStore.getState().sought).toEqual({ channelName: 'alice', messageId: 'a1' });
  });

  it('should search only the current window when asked to', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.type(input, 'deploy');
    await user.click(screen.getByRole('switch', { name: 'search.currentWindowOnly {"name":"#home"}' }));

    expect(options().map((option) => option.textContent)).toEqual(['#homebob01/01/2024 09:30the deploy went fine']);
  });

  it('should not offer to search only Debug, which is never searched', () => {
    setTestSession({ currentChannelName: 'Debug', currentChannelCategory: ChannelCategory.debug });

    renderSearch();

    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('should say when nothing matches, and stay on the current window', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.type(input, 'zzz{Enter}');

    expect(screen.getByText('search.empty')).toBeInTheDocument();
    expect(getActiveSession().currentChannelName).toBe('#home');
    expect(useGoToMessageStore.getState().sought).toBeUndefined();
  });

  it('should list a message that arrives while searching', async () => {
    const user = userEvent.setup();
    const { input } = renderSearch();
    await user.type(input, 'deploy');

    useChannelsStore.getState().setAddMessage(message('h2', 'deploy again', { target: '#home', time: new Date(2024, 0, 3).toISOString() }), 100);

    expect(await screen.findByText('again', { exact: false })).toBeInTheDocument();
    expect(options()).toHaveLength(3);
  });

  it('should keep a spoiler hidden in the listed message', async () => {
    setTestSlice(useChannelsStore, { openChannels: [channel('#home', ChannelCategory.channel, [message('s1', applySpoilerMarkup('the ending: ||he dies||', null))])] });
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.type(input, 'ending');

    expect(options()[0]).toHaveTextContent('the ending: ▒▒▒');
    expect(options()[0]).not.toHaveTextContent('dies');
  });

  it('should cut a long message to show the match', async () => {
    const lead = 'word '.repeat(40);
    setTestSlice(useChannelsStore, { openChannels: [channel('#home', ChannelCategory.channel, [message('l1', `${lead}needle here`)])] });
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.type(input, 'needle');

    const snippet = options()[0]?.querySelector('p');
    expect(snippet?.textContent).toBe(`…${lead.slice(-40)}needle here`);
  });

  it('should list only the newest 100 matches, and say so', async () => {
    const messages = Array.from({ length: 101 }, (_, index) => message(`m${index}`, `match ${index}`, { time: new Date(2024, 0, 1, 0, index).toISOString() }));
    setTestSlice(useChannelsStore, { openChannels: [channel('#home', ChannelCategory.channel, messages)] });
    const user = userEvent.setup();
    const { input } = renderSearch();

    await user.type(input, 'match');

    expect(options()).toHaveLength(100);
    expect(options()[0]).toHaveTextContent('match 100');
    expect(screen.getByText('search.more {"count":100}')).toBeInTheDocument();
  });
});
