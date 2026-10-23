import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IgnoreSetting from '../IgnoreSetting';
import { useIgnoreStore } from '@features/ignore/store/ignore';
import { useSettingsStore } from '@features/settings/store/settings';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { word?: string }) => (options?.word === undefined ? key : `${key}:${options.word}`),
  }),
}));

vi.mock('@/app/i18n', () => ({
  default: {},
}));

const masks = (): Record<string, string[]> => useIgnoreStore.getState().masksByNetwork;

describe('IgnoreSetting', () => {
  beforeEach(() => {
    useIgnoreStore.setState({ masksByNetwork: {} });
    useSettingsStore.setState({ server: { default: 0, encoding: 'utf8', network: 'TestNet', servers: ['irc.test:6667'] } });
  });

  it('should ignore a nick on the current network, as a mask', async () => {
    const user = userEvent.setup();
    render(<IgnoreSetting />);

    await user.type(screen.getByLabelText('profileSettings.ignored'), 'troll{Enter}');

    expect(masks()).toEqual({ TestNet: ['troll!*@*'] });
    expect(screen.getByLabelText('profileSettings.ignored')).toHaveValue('');
    expect(screen.getByTestId('ignored-list')).toHaveTextContent('troll!*@*');
  });

  it('should keep the typed text when it is not a mask', async () => {
    const user = userEvent.setup();
    render(<IgnoreSetting />);

    await user.type(screen.getByLabelText('profileSettings.ignored'), 'a@b@c');
    await user.click(screen.getByRole('button', { name: 'profileSettings.addIgnored' }));

    expect(masks()).toEqual({});
    expect(screen.getByLabelText('profileSettings.ignored')).toHaveValue('a@b@c');
  });

  it('should stop ignoring a mask', async () => {
    useIgnoreStore.setState({ masksByNetwork: { TestNet: ['troll!*@*', '*!*@spam.example'] } });
    const user = userEvent.setup();
    render(<IgnoreSetting />);

    await user.click(screen.getByRole('button', { name: 'profileSettings.removeIgnored:troll!*@*' }));

    expect(masks()).toEqual({ TestNet: ['*!*@spam.example'] });
  });

  it('should show only the current network list', () => {
    useIgnoreStore.setState({ masksByNetwork: { OtherNet: ['troll!*@*'] } });
    render(<IgnoreSetting />);

    expect(screen.queryByTestId('ignored-list')).not.toBeInTheDocument();
  });

  it('should not render without a network', () => {
    useSettingsStore.setState({ server: undefined });
    const { container } = render(<IgnoreSetting />);

    expect(container).toBeEmptyDOMElement();
  });
});
