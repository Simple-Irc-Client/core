import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InputContextMenu } from '../InputContextMenu';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('InputContextMenu', () => {
  const defaultProps = {
    contextMenuPosition: { x: 100, y: 200 } as { x: number; y: number } | null,
    hasSelection: true,
    hasContent: true,
    allSelected: false,
    onClose: vi.fn(),
    onCut: vi.fn(),
    onCopy: vi.fn(),
    onPaste: vi.fn(),
    onSelectAll: vi.fn(),
  };

  it('should render menu items when position is set', () => {
    render(<InputContextMenu {...defaultProps} />);

    expect(document.body.textContent).toContain('contextmenu.input.cut');
    expect(document.body.textContent).toContain('contextmenu.input.copy');
    expect(document.body.textContent).toContain('contextmenu.input.paste');
    expect(document.body.textContent).toContain('contextmenu.input.selectAll');
  });

  it('should position menu at given coordinates', () => {
    render(<InputContextMenu {...defaultProps} contextMenuPosition={{ x: 150, y: 300 }} />);

    const menuContent = document.body.querySelector('[role="menu"]');
    expect(menuContent).toHaveStyle({ left: '150px', top: '300px' });
  });

  it('should clamp position when menu would overflow bottom', () => {
    Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });

    render(<InputContextMenu {...defaultProps} contextMenuPosition={{ x: 100, y: 550 }} />);

    const menuContent = document.body.querySelector('[role="menu"]');
    expect(menuContent).toHaveStyle({ top: '390px' });
  });

  it('should clamp position when menu would overflow right', () => {
    Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });

    render(<InputContextMenu {...defaultProps} contextMenuPosition={{ x: 750, y: 100 }} />);

    const menuContent = document.body.querySelector('[role="menu"]');
    expect(menuContent).toHaveStyle({ left: '640px' });
  });

  it.each([
    { label: 'contextmenu.input.cut', callbackName: 'onCut' },
    { label: 'contextmenu.input.copy', callbackName: 'onCopy' },
    { label: 'contextmenu.input.paste', callbackName: 'onPaste' },
    { label: 'contextmenu.input.selectAll', callbackName: 'onSelectAll' },
  ])('should call $callbackName and onClose when $label is clicked', ({ label, callbackName }) => {
    const callback = vi.fn();
    const onClose = vi.fn();
    const props = { ...defaultProps, onClose, [callbackName]: callback };

    render(<InputContextMenu {...props} />);

    const item = screen.getByText(label);
    fireEvent.click(item);

    expect(callback).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('should disable Cut and Copy when no text is selected', () => {
    render(<InputContextMenu {...defaultProps} hasSelection={false} />);

    const cutItem = screen.getByText('contextmenu.input.cut');
    const copyItem = screen.getByText('contextmenu.input.copy');
    const pasteItem = screen.getByText('contextmenu.input.paste');

    expect(cutItem).toHaveAttribute('aria-disabled');
    expect(copyItem).toHaveAttribute('aria-disabled');
    expect(pasteItem).not.toHaveAttribute('aria-disabled');
  });

  it('should disable Select All when input is empty', () => {
    render(<InputContextMenu {...defaultProps} hasContent={false} hasSelection={false} />);

    const selectAllItem = screen.getByText('contextmenu.input.selectAll');
    expect(selectAllItem).toHaveAttribute('aria-disabled');
  });

  it('should enable Select All when input has content and not all selected', () => {
    render(<InputContextMenu {...defaultProps} hasContent={true} hasSelection={false} allSelected={false} />);

    const selectAllItem = screen.getByText('contextmenu.input.selectAll');
    expect(selectAllItem).not.toHaveAttribute('aria-disabled');
  });

  it('should disable Select All when all text is already selected', () => {
    render(<InputContextMenu {...defaultProps} hasContent={true} hasSelection={true} allSelected={true} />);

    const selectAllItem = screen.getByText('contextmenu.input.selectAll');
    expect(selectAllItem).toHaveAttribute('aria-disabled');
  });

  it('should not render menu content when position is null', () => {
    const { container } = render(<InputContextMenu {...defaultProps} contextMenuPosition={null} />);

    const menuContent = container.querySelector('[role="menu"]');
    expect(menuContent).toBeNull();
  });
});
