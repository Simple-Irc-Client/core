import { describe, expect, it, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WizardServer from '../WizardServer';
import * as settingsStore from '@features/settings/store/settings';
import * as network from '@/network/irc/network';
import * as serversModule from '@/network/irc/servers';

// Mock browser APIs for Popover/Command components
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  Element.prototype.scrollIntoView = vi.fn();
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/network/irc/network', () => ({
  ircConnect: vi.fn(),
}));

vi.mock('@features/settings/store/settings', () => ({
  getCurrentNick: vi.fn(),
  setWizardStep: vi.fn(),
  setIsConnecting: vi.fn(),
  setServer: vi.fn(),
}));

const mockServers: serversModule.Server[] = [
  {
    default: 0,
    encoding: 'utf8',
    flags: 19,
    network: 'TestNet1',
    servers: ['irc.testnet1.org'],
  },
  {
    default: 0,
    encoding: 'utf8',
    flags: 23,
    network: 'TestNet2',
    servers: ['irc.testnet2.org'],
  },
  {
    default: 0,
    encoding: 'utf8',
    flags: 19,
    network: 'TestNet3',
    servers: ['irc.testnet3.org'],
  },
];

vi.mock('@/network/irc/servers', () => ({
  servers: [
    {
      default: 0,
      encoding: 'utf8',
      flags: 19,
      network: 'TestNet1',
      servers: ['irc.testnet1.org'],
    },
    {
      default: 0,
      encoding: 'utf8',
      flags: 23,
      network: 'TestNet2',
      servers: ['irc.testnet2.org'],
    },
    {
      default: 0,
      encoding: 'utf8',
      flags: 19,
      network: 'TestNet3',
      servers: ['irc.testnet3.org'],
    },
  ],
  serverIcons: {},
}));

describe('WizardServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(settingsStore.getCurrentNick).mockReturnValue('TestNick');
  });

  describe('Basic rendering', () => {
    it('should render the title', () => {
      render(<WizardServer />);

      expect(screen.getByText('wizard.server.title')).toBeInTheDocument();
    });

    it('should render the server selection button', () => {
      render(<WizardServer />);

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should show placeholder text when no server selected', () => {
      render(<WizardServer />);

      expect(screen.getByText('wizard.server.server')).toBeInTheDocument();
    });

    it('should render the next button', () => {
      render(<WizardServer />);

      expect(screen.getByText('wizard.server.button.next')).toBeInTheDocument();
    });

    it('should have disabled next button initially', () => {
      render(<WizardServer />);

      const button = screen.getByText('wizard.server.button.next');
      expect(button).toBeDisabled();
    });
  });

  describe('Server selection popover', () => {
    it('should open popover when combobox is clicked', () => {
      render(<WizardServer />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);

      expect(screen.getByPlaceholderText('wizard.server.server')).toBeInTheDocument();
    });

    it('should display available servers in popover', () => {
      render(<WizardServer />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);

      expect(screen.getByText('TestNet1')).toBeInTheDocument();
      expect(screen.getByText('TestNet2')).toBeInTheDocument();
      expect(screen.getByText('TestNet3')).toBeInTheDocument();
    });

    it('should show no options message when search has no matches', () => {
      render(<WizardServer />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);

      const searchInput = screen.getByPlaceholderText('wizard.server.server');
      fireEvent.change(searchInput, { target: { value: 'nonexistentserver' } });

      expect(screen.getByText('wizard.server.message.no.options')).toBeInTheDocument();
    });

    it('should select server when clicked', () => {
      render(<WizardServer />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);

      const serverOption = screen.getByText('TestNet1');
      fireEvent.click(serverOption);

      // The combobox should now show the selected server name
      expect(screen.getByRole('combobox')).toHaveTextContent('TestNet1');
    });

    it('should close popover after selecting a server', () => {
      render(<WizardServer />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);

      const serverOption = screen.getByText('TestNet1');
      fireEvent.click(serverOption);

      // Search input should no longer be visible (popover closed)
      expect(screen.queryByPlaceholderText('wizard.server.server')).not.toBeInTheDocument();
    });

    it('should show check icon for selected server', () => {
      render(<WizardServer />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);

      // Select a server
      const serverOption = screen.getByText('TestNet1');
      fireEvent.click(serverOption);

      // Reopen popover
      fireEvent.click(combobox);

      // The selected server should have an opacity-100 check icon
      const checkIcons = document.querySelectorAll('.lucide-check');
      const visibleCheckIcon = Array.from(checkIcons).find(
        (icon) => icon.classList.contains('opacity-100')
      );
      expect(visibleCheckIcon).toBeTruthy();
    });
  });

  describe('Button state', () => {
    it('should enable button when server is selected', () => {
      render(<WizardServer />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);

      const serverOption = screen.getByText('TestNet1');
      fireEvent.click(serverOption);

      const button = screen.getByText('wizard.server.button.next');
      expect(button).not.toBeDisabled();
    });

    it('should keep button enabled after changing server selection', () => {
      render(<WizardServer />);

      const combobox = screen.getByRole('combobox');

      // Select first server
      fireEvent.click(combobox);
      fireEvent.click(screen.getByText('TestNet1'));

      // Select different server
      fireEvent.click(combobox);
      fireEvent.click(screen.getByText('TestNet2'));

      const button = screen.getByText('wizard.server.button.next');
      expect(button).not.toBeDisabled();
    });
  });

  describe('Form submission', () => {
    it('should call setServer with selected server when button is clicked', () => {
      render(<WizardServer />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);
      fireEvent.click(screen.getByText('TestNet1'));

      const button = screen.getByText('wizard.server.button.next');
      fireEvent.click(button);

      expect(settingsStore.setServer).toHaveBeenCalledWith(mockServers[0]);
    });

    it('should call getCurrentNick when button is clicked', () => {
      render(<WizardServer />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);
      fireEvent.click(screen.getByText('TestNet1'));

      const button = screen.getByText('wizard.server.button.next');
      fireEvent.click(button);

      expect(settingsStore.getCurrentNick).toHaveBeenCalled();
    });

    it('should call ircConnect with server and nick when button is clicked', () => {
      vi.mocked(settingsStore.getCurrentNick).mockReturnValue('MyNick');

      render(<WizardServer />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);
      fireEvent.click(screen.getByText('TestNet1'));

      const button = screen.getByText('wizard.server.button.next');
      fireEvent.click(button);

      expect(network.ircConnect).toHaveBeenCalledWith(mockServers[0], 'MyNick');
    });

    it('should call setIsConnecting with true when button is clicked', () => {
      render(<WizardServer />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);
      fireEvent.click(screen.getByText('TestNet1'));

      const button = screen.getByText('wizard.server.button.next');
      fireEvent.click(button);

      expect(settingsStore.setIsConnecting).toHaveBeenCalledWith(true);
    });

    it('should call setWizardStep with "loading" when button is clicked', () => {
      render(<WizardServer />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);
      fireEvent.click(screen.getByText('TestNet1'));

      const button = screen.getByText('wizard.server.button.next');
      fireEvent.click(button);

      expect(settingsStore.setWizardStep).toHaveBeenCalledWith('loading');
    });

    it('should call handlers in correct order', () => {
      const callOrder: string[] = [];

      vi.mocked(settingsStore.setServer).mockImplementation(() => {
        callOrder.push('setServer');
      });
      vi.mocked(settingsStore.getCurrentNick).mockImplementation(() => {
        callOrder.push('getCurrentNick');
        return 'TestNick';
      });
      vi.mocked(network.ircConnect).mockImplementation(() => {
        callOrder.push('ircConnect');
      });
      vi.mocked(settingsStore.setIsConnecting).mockImplementation(() => {
        callOrder.push('setIsConnecting');
      });
      vi.mocked(settingsStore.setWizardStep).mockImplementation(() => {
        callOrder.push('setWizardStep');
      });

      render(<WizardServer />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);
      fireEvent.click(screen.getByText('TestNet1'));

      const button = screen.getByText('wizard.server.button.next');
      fireEvent.click(button);

      expect(callOrder).toEqual([
        'setServer',
        'getCurrentNick',
        'ircConnect',
        'setIsConnecting',
        'setWizardStep',
      ]);
    });

    it('should submit form via Enter key', () => {
      render(<WizardServer />);

      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);
      fireEvent.click(screen.getByText('TestNet1'));

      const form = document.querySelector('form');
      if (!form) {
        throw new Error('Form not found');
      }
      fireEvent.submit(form);

      expect(settingsStore.setServer).toHaveBeenCalledWith(mockServers[0]);
      expect(settingsStore.setWizardStep).toHaveBeenCalledWith('loading');
    });
  });

  describe('Edge cases', () => {
    it('should not proceed when no server is selected and button is disabled', () => {
      render(<WizardServer />);

      const button = screen.getByText('wizard.server.button.next');
      expect(button).toBeDisabled();

      fireEvent.click(button);

      expect(settingsStore.setServer).not.toHaveBeenCalled();
      expect(network.ircConnect).not.toHaveBeenCalled();
      expect(settingsStore.setWizardStep).not.toHaveBeenCalled();
    });

    it('should handle selecting different servers', () => {
      render(<WizardServer />);

      const combobox = screen.getByRole('combobox');

      // Select TestNet1
      fireEvent.click(combobox);
      fireEvent.click(screen.getByText('TestNet1'));
      expect(screen.getByRole('combobox')).toHaveTextContent('TestNet1');

      // Select TestNet2
      fireEvent.click(combobox);
      fireEvent.click(screen.getByText('TestNet2'));
      expect(screen.getByRole('combobox')).toHaveTextContent('TestNet2');

      // Select TestNet3
      fireEvent.click(combobox);
      fireEvent.click(screen.getByText('TestNet3'));
      expect(screen.getByRole('combobox')).toHaveTextContent('TestNet3');

      // Submit with TestNet3 selected
      const button = screen.getByText('wizard.server.button.next');
      fireEvent.click(button);

      expect(settingsStore.setServer).toHaveBeenCalledWith(mockServers[2]);
    });
  });

  describe('Custom server with connection type', () => {
    it('should show connection type selector when custom host is entered', () => {
      render(<WizardServer />);

      const hostInput = screen.getByPlaceholderText('wizard.server.host');
      fireEvent.change(hostInput, { target: { value: 'custom.irc.net' } });

      expect(screen.getByText('wizard.server.connectionType')).toBeInTheDocument();
      expect(screen.getByText('wizard.server.connectionType.backend')).toBeInTheDocument();
      expect(screen.getByText('wizard.server.connectionType.websocket')).toBeInTheDocument();
    });

    it('should not show connection type selector when custom host is empty', () => {
      render(<WizardServer />);

      expect(screen.queryByText('wizard.server.connectionType')).not.toBeInTheDocument();
    });

    it('should default to backend connection type', () => {
      render(<WizardServer />);

      const hostInput = screen.getByPlaceholderText('wizard.server.host');
      fireEvent.change(hostInput, { target: { value: 'custom.irc.net' } });

      const backendButton = screen.getByText('wizard.server.connectionType.backend');
      // The default button should have the "default" variant (not outline)
      expect(backendButton.closest('button')).not.toHaveClass('border-input');
    });

    it('should enable next button when custom host is entered', () => {
      render(<WizardServer />);

      const hostInput = screen.getByPlaceholderText('wizard.server.host');
      fireEvent.change(hostInput, { target: { value: 'custom.irc.net' } });

      const button = screen.getByText('wizard.server.button.next');
      expect(button).not.toBeDisabled();
    });

    it('should create backend server config by default', () => {
      vi.mocked(settingsStore.getCurrentNick).mockReturnValue('TestNick');
      render(<WizardServer />);

      const hostInput = screen.getByPlaceholderText('wizard.server.host');
      fireEvent.change(hostInput, { target: { value: 'custom.irc.net' } });

      const button = screen.getByText('wizard.server.button.next');
      fireEvent.click(button);

      expect(settingsStore.setServer).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionType: 'backend',
          network: 'custom.irc.net',
          servers: ['custom.irc.net'],
        })
      );
    });

    it('should create websocket server config when websocket is selected', () => {
      vi.mocked(settingsStore.getCurrentNick).mockReturnValue('TestNick');
      render(<WizardServer />);

      const hostInput = screen.getByPlaceholderText('wizard.server.host');
      fireEvent.change(hostInput, { target: { value: 'custom.irc.net' } });

      // Set port to 443 (default for wss) to get clean URL
      const portInput = screen.getByPlaceholderText('wizard.server.port');
      fireEvent.change(portInput, { target: { value: '443' } });

      const websocketButton = screen.getByText('wizard.server.connectionType.websocket');
      fireEvent.click(websocketButton);

      const button = screen.getByText('wizard.server.button.next');
      fireEvent.click(button);

      expect(settingsStore.setServer).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionType: 'websocket',
          network: 'custom.irc.net',
          servers: ['custom.irc.net:443'],
          tls: true,
          websocketUrl: 'wss://custom.irc.net/',
        })
      );
    });

    it('should include custom port in websocket URL', () => {
      vi.mocked(settingsStore.getCurrentNick).mockReturnValue('TestNick');
      render(<WizardServer />);

      const hostInput = screen.getByPlaceholderText('wizard.server.host');
      fireEvent.change(hostInput, { target: { value: 'custom.irc.net' } });

      const portInput = screen.getByPlaceholderText('wizard.server.port');
      fireEvent.change(portInput, { target: { value: '8080' } });

      const websocketButton = screen.getByText('wizard.server.connectionType.websocket');
      fireEvent.click(websocketButton);

      const button = screen.getByText('wizard.server.button.next');
      fireEvent.click(button);

      expect(settingsStore.setServer).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionType: 'websocket',
          websocketUrl: 'wss://custom.irc.net:8080/',
        })
      );
    });

    it('should include custom port in servers array for backend', () => {
      vi.mocked(settingsStore.getCurrentNick).mockReturnValue('TestNick');
      render(<WizardServer />);

      const hostInput = screen.getByPlaceholderText('wizard.server.host');
      fireEvent.change(hostInput, { target: { value: 'custom.irc.net' } });

      const portInput = screen.getByPlaceholderText('wizard.server.port');
      fireEvent.change(portInput, { target: { value: '7000' } });

      const button = screen.getByText('wizard.server.button.next');
      fireEvent.click(button);

      expect(settingsStore.setServer).toHaveBeenCalledWith(
        expect.objectContaining({
          servers: ['custom.irc.net:7000'],
        })
      );
    });

    it('should allow switching between connection types', () => {
      render(<WizardServer />);

      const hostInput = screen.getByPlaceholderText('wizard.server.host');
      fireEvent.change(hostInput, { target: { value: 'custom.irc.net' } });

      // Click websocket
      const websocketButton = screen.getByText('wizard.server.connectionType.websocket');
      fireEvent.click(websocketButton);

      // Click backend
      const backendButton = screen.getByText('wizard.server.connectionType.backend');
      fireEvent.click(backendButton);

      const button = screen.getByText('wizard.server.button.next');
      fireEvent.click(button);

      expect(settingsStore.setServer).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionType: 'backend',
        })
      );
    });

    it('should clear custom mode when selecting a predefined server', () => {
      render(<WizardServer />);

      // Enter custom server
      const hostInput = screen.getByPlaceholderText('wizard.server.host');
      fireEvent.change(hostInput, { target: { value: 'custom.irc.net' } });

      // Connection type selector should be visible
      expect(screen.getByText('wizard.server.connectionType')).toBeInTheDocument();

      // Select a predefined server from popover
      const combobox = screen.getByRole('combobox');
      fireEvent.click(combobox);
      fireEvent.click(screen.getByText('TestNet1'));

      // Connection type selector should be hidden now
      expect(screen.queryByText('wizard.server.connectionType')).not.toBeInTheDocument();
    });
  });
});
