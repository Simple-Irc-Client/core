import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import StylePicker from '../StylePicker';
import * as settingsStore from '@features/settings/store/settings';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('StylePicker', () => {
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
    it('should render the style picker trigger button', () => {
      render(<StylePicker open={false} onOpenChange={mockOnOpenChange} />);

      const button = screen.getByRole('button', { name: 'main.toolbar.textStyleAriaLabel' });
      expect(button).toBeInTheDocument();
    });

    it('should not show active style indicator when no styles are active', () => {
      render(<StylePicker open={false} onOpenChange={mockOnOpenChange} />);

      const button = screen.getByRole('button', { name: 'main.toolbar.textStyleAriaLabel' });
      const indicator = button.querySelector('span.absolute');
      expect(indicator).not.toBeInTheDocument();
    });

    it('should show active style indicator when bold is active', () => {
      vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
        selector({
          fontFormatting: { colorCode: null, bold: true, italic: false, underline: false },
          setFontFormatting: mockSetFontFormatting,
        } as unknown as settingsStore.SettingsStore)
      );

      render(<StylePicker open={false} onOpenChange={mockOnOpenChange} />);

      const button = screen.getByRole('button', { name: 'main.toolbar.textStyleAriaLabel' });
      const indicator = button.querySelector('span.absolute');
      expect(indicator).toBeInTheDocument();
    });

    it('should show active style indicator when italic is active', () => {
      vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
        selector({
          fontFormatting: { colorCode: null, bold: false, italic: true, underline: false },
          setFontFormatting: mockSetFontFormatting,
        } as unknown as settingsStore.SettingsStore)
      );

      render(<StylePicker open={false} onOpenChange={mockOnOpenChange} />);

      const button = screen.getByRole('button', { name: 'main.toolbar.textStyleAriaLabel' });
      const indicator = button.querySelector('span.absolute');
      expect(indicator).toBeInTheDocument();
    });

    it('should show active style indicator when underline is active', () => {
      vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
        selector({
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: true },
          setFontFormatting: mockSetFontFormatting,
        } as unknown as settingsStore.SettingsStore)
      );

      render(<StylePicker open={false} onOpenChange={mockOnOpenChange} />);

      const button = screen.getByRole('button', { name: 'main.toolbar.textStyleAriaLabel' });
      const indicator = button.querySelector('span.absolute');
      expect(indicator).toBeInTheDocument();
    });

    it('should render popover content when open', () => {
      render(<StylePicker open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByText('main.toolbar.textStyle')).toBeInTheDocument();
    });

    it('should render all three style buttons', () => {
      render(<StylePicker open={true} onOpenChange={mockOnOpenChange} />);

      expect(screen.getByText('main.toolbar.bold')).toBeInTheDocument();
      expect(screen.getByText('main.toolbar.italic')).toBeInTheDocument();
      expect(screen.getByText('main.toolbar.underline')).toBeInTheDocument();
    });
  });

  describe('Bold toggle', () => {
    it('should toggle bold on when clicking bold button', () => {
      render(<StylePicker open={true} onOpenChange={mockOnOpenChange} />);

      const boldButton = screen.getByText('main.toolbar.bold').closest('button');
      fireEvent.click(boldButton!);

      expect(mockSetFontFormatting).toHaveBeenCalledWith({ bold: true });
    });

    it('should toggle bold off when clicking bold button while bold is active', () => {
      vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
        selector({
          fontFormatting: { colorCode: null, bold: true, italic: false, underline: false },
          setFontFormatting: mockSetFontFormatting,
        } as unknown as settingsStore.SettingsStore)
      );

      render(<StylePicker open={true} onOpenChange={mockOnOpenChange} />);

      const boldButton = screen.getByText('main.toolbar.bold').closest('button');
      fireEvent.click(boldButton!);

      expect(mockSetFontFormatting).toHaveBeenCalledWith({ bold: false });
    });

    it('should show bold button as active when bold is enabled', () => {
      vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
        selector({
          fontFormatting: { colorCode: null, bold: true, italic: false, underline: false },
          setFontFormatting: mockSetFontFormatting,
        } as unknown as settingsStore.SettingsStore)
      );

      render(<StylePicker open={true} onOpenChange={mockOnOpenChange} />);

      const boldButton = screen.getByText('main.toolbar.bold').closest('button');
      // When active, variant is 'default' which doesn't have 'outline' class
      expect(boldButton).not.toHaveClass('border-input');
    });
  });

  describe('Italic toggle', () => {
    it('should toggle italic on when clicking italic button', () => {
      render(<StylePicker open={true} onOpenChange={mockOnOpenChange} />);

      const italicButton = screen.getByText('main.toolbar.italic').closest('button');
      fireEvent.click(italicButton!);

      expect(mockSetFontFormatting).toHaveBeenCalledWith({ italic: true });
    });

    it('should toggle italic off when clicking italic button while italic is active', () => {
      vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
        selector({
          fontFormatting: { colorCode: null, bold: false, italic: true, underline: false },
          setFontFormatting: mockSetFontFormatting,
        } as unknown as settingsStore.SettingsStore)
      );

      render(<StylePicker open={true} onOpenChange={mockOnOpenChange} />);

      const italicButton = screen.getByText('main.toolbar.italic').closest('button');
      fireEvent.click(italicButton!);

      expect(mockSetFontFormatting).toHaveBeenCalledWith({ italic: false });
    });
  });

  describe('Underline toggle', () => {
    it('should toggle underline on when clicking underline button', () => {
      render(<StylePicker open={true} onOpenChange={mockOnOpenChange} />);

      const underlineButton = screen.getByText('main.toolbar.underline').closest('button');
      fireEvent.click(underlineButton!);

      expect(mockSetFontFormatting).toHaveBeenCalledWith({ underline: true });
    });

    it('should toggle underline off when clicking underline button while underline is active', () => {
      vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
        selector({
          fontFormatting: { colorCode: null, bold: false, italic: false, underline: true },
          setFontFormatting: mockSetFontFormatting,
        } as unknown as settingsStore.SettingsStore)
      );

      render(<StylePicker open={true} onOpenChange={mockOnOpenChange} />);

      const underlineButton = screen.getByText('main.toolbar.underline').closest('button');
      fireEvent.click(underlineButton!);

      expect(mockSetFontFormatting).toHaveBeenCalledWith({ underline: false });
    });
  });

  describe('Multiple styles', () => {
    it('should show indicator when multiple styles are active', () => {
      vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
        selector({
          fontFormatting: { colorCode: null, bold: true, italic: true, underline: true },
          setFontFormatting: mockSetFontFormatting,
        } as unknown as settingsStore.SettingsStore)
      );

      render(<StylePicker open={false} onOpenChange={mockOnOpenChange} />);

      const button = screen.getByRole('button', { name: 'main.toolbar.textStyleAriaLabel' });
      const indicator = button.querySelector('span.absolute');
      expect(indicator).toBeInTheDocument();
    });

    it('should allow toggling individual styles independently', () => {
      vi.spyOn(settingsStore, 'useSettingsStore').mockImplementation((selector) =>
        selector({
          fontFormatting: { colorCode: null, bold: true, italic: false, underline: true },
          setFontFormatting: mockSetFontFormatting,
        } as unknown as settingsStore.SettingsStore)
      );

      render(<StylePicker open={true} onOpenChange={mockOnOpenChange} />);

      const italicButton = screen.getByText('main.toolbar.italic').closest('button');
      fireEvent.click(italicButton!);

      // Should only toggle italic, not affect other styles
      expect(mockSetFontFormatting).toHaveBeenCalledWith({ italic: true });
    });
  });
});
