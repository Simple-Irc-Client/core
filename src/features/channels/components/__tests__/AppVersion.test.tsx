import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import AppVersion from '../AppVersion';

const getAppVersionMock = vi.fn<() => Promise<string | null>>();

vi.mock('@/runtime/desktop', () => ({
  getAppVersion: () => getAppVersionMock(),
}));

vi.stubGlobal('__GIT_REF__', 'abc1234');

describe('AppVersion', () => {
  beforeEach(() => {
    getAppVersionMock.mockReset();
  });

  it('shows only the git ref on the web', async () => {
    getAppVersionMock.mockResolvedValue(null);
    render(<AppVersion />);

    expect(await screen.findByText('abc1234')).toBeInTheDocument();
  });

  it('shows the app version and git ref in Tauri builds', async () => {
    getAppVersionMock.mockResolvedValue('2.0.9');
    render(<AppVersion />);

    expect(await screen.findByText('v2.0.9 · abc1234')).toBeInTheDocument();
  });

  it('falls back to the git ref while the version lookup is pending', () => {
    getAppVersionMock.mockReturnValue(new Promise(() => {}));
    render(<AppVersion />);

    expect(screen.getByTestId('app-version')).toHaveTextContent('abc1234');
  });

});
