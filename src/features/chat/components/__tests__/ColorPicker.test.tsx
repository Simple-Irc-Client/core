import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ColorPicker from '../ColorPicker';
import * as settingsStore from '@features/settings/store/settings';
import { IRC_COLORS } from '@/shared/lib/ircFormatting';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
  }),
}));

describe('ColorPicker', () => {
  const mockSetFontFormatting = vi.fn();
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
      selector({
        fontFormatting: { colorCode: null, bold: false, italic: false, underline: false },
        setFontFormatting: mockSetFontFormatting,
      } as unknown as settingsStore.SettingsStore)
    );
  });

  describe('Basic rendering', () => {
    it('should render the color picker trigger button', () => {
      render(<ColorPicker open={false} onOpenChange={mockOnOpenChange} />);

      const button = screen.getByRole('button', { name: 'main.toolbar.textColorAriaLabel' });
      expect(button).toBeInTheDocument();
    });

    it('should not show color indicator when no color is selected', () => {
      render(<ColorPicker open={false} onOpenChange={mockOnOpenChange} />);

      const button = screen.getByRole('button', { name: 'main.toolbar.textColorAriaLabel' });
      const indicator = button.querySelector('span.absolute');
      expect(indicator).not.toBeInTheDocument();
    });

    it('should show color indicator when a color is selected', () => {
      vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
        selector({
          fontFormatting: { colorCode: 4, bold: false, italic: false, underline: false },
          setFontFormatting: mockSetFontFormatting,
        } as unknown as settingsStore.SettingsStore)
      );

      render(<ColorPicker open={false} onOpenChange={mockOnOpenChange} />);

      const button = screen.getByRole('button', { name: 'main.toolbar.textColorAriaLabel' });
      const indicator = button.querySelector('span.absolute');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveStyle({ backgroundColor: IRC_COLORS[4] });
    });

    it('should render popover content when open', () => {
      render(<ColorPicker open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByText('main.toolbar.textColor')).toBeInTheDocument();
    });

    it('should render all 16 standard IRC colors', () => {
      render(<ColorPicker open={true} onOpenChange={mockOnOpenChange} />);

      const colorButtons = screen.getAllByRole('button').filter((btn) => btn.hasAttribute('title'));
      expect(colorButtons.length).toBe(Object.keys(IRC_COLORS).length);
    });
  });

  describe('Color selection', () => {
    it('should call setFontFormatting with color code when clicking a color', () => {
      render(<ColorPicker open={true} onOpenChange={mockOnOpenChange} />);

      const colorButtons = screen.getAllByRole('button').filter((btn) => btn.hasAttribute('title'));
      fireEvent.click(colorButtons[4]!); // Click color code 4 (red)

      expect(mockSetFontFormatting).toHaveBeenCalledWith({ colorCode: 4 });
    });

    it('should close the popover after selecting a color', () => {
      render(<ColorPicker open={true} onOpenChange={mockOnOpenChange} />);

      const colorButtons = screen.getAllByRole('button').filter((btn) => btn.hasAttribute('title'));
      fireEvent.click(colorButtons[0]!);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should show selected state on the currently selected color', () => {
      vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
        selector({
          fontFormatting: { colorCode: 2, bold: false, italic: false, underline: false },
          setFontFormatting: mockSetFontFormatting,
        } as unknown as settingsStore.SettingsStore)
      );

      render(<ColorPicker open={true} onOpenChange={mockOnOpenChange} />);

      const colorButtons = screen.getAllByRole('button').filter((btn) => btn.hasAttribute('title'));
      expect(colorButtons[2]).toHaveClass('border-primary');
    });
  });

  describe('Clear color functionality', () => {
    it('should not show clear button when no color is selected', () => {
      render(<ColorPicker open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.queryByText('main.toolbar.clearColor')).not.toBeInTheDocument();
    });

    it('should show clear button when a color is selected', () => {
      vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
        selector({
          fontFormatting: { colorCode: 5, bold: false, italic: false, underline: false },
          setFontFormatting: mockSetFontFormatting,
        } as unknown as settingsStore.SettingsStore)
      );

      render(<ColorPicker open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByText('main.toolbar.clearColor')).toBeInTheDocument();
    });

    it('should clear the color when clicking the clear button', () => {
      vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
        selector({
          fontFormatting: { colorCode: 5, bold: false, italic: false, underline: false },
          setFontFormatting: mockSetFontFormatting,
        } as unknown as settingsStore.SettingsStore)
      );

      render(<ColorPicker open={true} onOpenChange={mockOnOpenChange} />);

      const clearButton = screen.getByText('main.toolbar.clearColor');
      fireEvent.click(clearButton);

      expect(mockSetFontFormatting).toHaveBeenCalledWith({ colorCode: null });
    });

    it('should close the popover after clearing the color', () => {
      vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
        selector({
          fontFormatting: { colorCode: 5, bold: false, italic: false, underline: false },
          setFontFormatting: mockSetFontFormatting,
        } as unknown as settingsStore.SettingsStore)
      );

      render(<ColorPicker open={true} onOpenChange={mockOnOpenChange} />);

      const clearButton = screen.getByText('main.toolbar.clearColor');
      fireEvent.click(clearButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Color titles', () => {
    it('should render color buttons with correct titles', () => {
      render(<ColorPicker open={true} onOpenChange={mockOnOpenChange} />);

      const colorButtons = screen.getAllByRole('button').filter((btn) => btn.hasAttribute('title'));

      // Check that each color button has a title with the color code
      colorButtons.forEach((button, index) => {
        expect(button).toHaveAttribute('title', `main.toolbar.color ${JSON.stringify({ code: String(index) })}`);
      });
    });
  });
});
