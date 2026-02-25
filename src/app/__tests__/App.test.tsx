import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import App from '../App';

vi.mock('../i18n', () => ({}));

vi.mock('@/providers/DrawersProvider', () => ({
  DrawersProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/providers/ContextMenuProvider', () => ({
  ContextMenuProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/shared/components/ContextMenu', () => ({
  ContextMenu: () => null,
}));

vi.mock('../Network', () => ({
  Network: () => null,
}));

vi.mock('@/layouts/MainLayout', () => ({
  default: () => <div data-testid="main-layout" />,
}));

const mockDisconnectOnly = vi.fn();
const mockSetWizardCompleted = vi.fn();

vi.mock('@features/settings/store/settings', () => ({
  useSettingsStore: (selector: (state: { isDarkMode: boolean }) => unknown) =>
    selector({ isDarkMode: false }),
  disconnectOnly: (...args: unknown[]) => mockDisconnectOnly(...args),
  setWizardCompleted: (...args: unknown[]) => mockSetWizardCompleted(...args),
}));

let mockIsGatewayMode = false;
vi.mock('@/config/config', () => ({
  isGatewayMode: () => mockIsGatewayMode,
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsGatewayMode = false;
    cleanup();
  });

  it('should register beforeunload handler in gateway mode', () => {
    mockIsGatewayMode = true;
    const addSpy = vi.spyOn(window, 'addEventListener');

    render(<App />);

    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    addSpy.mockRestore();
  });

  it('should not register beforeunload handler outside gateway mode', () => {
    mockIsGatewayMode = false;
    const addSpy = vi.spyOn(window, 'addEventListener');

    render(<App />);

    expect(addSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));
    addSpy.mockRestore();
  });

  it('should disconnect and reset wizard on beforeunload in gateway mode', () => {
    mockIsGatewayMode = true;
    render(<App />);

    window.dispatchEvent(new Event('beforeunload'));

    expect(mockDisconnectOnly).toHaveBeenCalled();
    expect(mockSetWizardCompleted).toHaveBeenCalledWith(false);
  });

  it('should remove beforeunload handler on unmount', () => {
    mockIsGatewayMode = true;
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = render(<App />);
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
    removeSpy.mockRestore();
  });
});
