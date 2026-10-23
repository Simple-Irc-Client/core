import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppearanceTab from '../tabs/AppearanceTab';
import { useSettingsStore } from '@features/settings/store/settings';
import { BUILTIN_LAYOUT_CSS } from '@features/themes/builtinThemes';
import { IRC_DARK_COLORS, IRC_LIGHT_COLORS } from '@features/themes/palette';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/app/i18n', () => ({
  default: {
    changeLanguage: vi.fn(),
  },
}));

// CodeMirror needs DOM measurement APIs jsdom lacks; a plain textarea keeps the
// editor flow testable (the real editor is covered by the e2e suite)
vi.mock('@uiw/react-codemirror', () => ({
  default: ({ value, onChange }: { value: string; onChange?: (newValue: string) => void }) => (
    <textarea data-testid="codemirror-mock" value={value} onChange={(e) => onChange?.(e.target.value)} />
  ),
}));

// Radix Select needs pointer-capture APIs and scrollIntoView, which jsdom lacks
beforeAll(() => {
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.setPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});

describe('AppearanceTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      theme: 'modern',
      customThemes: {},
      builtinThemeOverrides: {},
      fontSize: 'medium',
      hideAvatarsInUsersList: false,
    });
  });

  describe('Theme selection', () => {
    it('should render the theme select showing the active theme', () => {
      render(<AppearanceTab />);

      const trigger = screen.getByTestId('theme-select');
      expect(trigger).toBeInTheDocument();
      expect(trigger.textContent).toContain('profileSettings.layoutModern');
    });

    it('should switch the theme via the dropdown', async () => {
      const user = userEvent.setup();

      render(<AppearanceTab />);

      await user.click(screen.getByTestId('theme-select'));
      await user.click(screen.getByTestId('theme-classic'));

      expect(useSettingsStore.getState().theme).toBe('classic');
    });

    it('should list custom themes in the dropdown', async () => {
      const user = userEvent.setup();
      const id = useSettingsStore.getState().addCustomTheme('Neon', '.sic-msg {}');

      render(<AppearanceTab />);

      await user.click(screen.getByTestId('theme-select'));

      expect(screen.getByTestId(`theme-${id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`theme-${id}`).textContent).toContain('Neon');
    });

    it('should show edit and new buttons, but no delete button for builtin themes', () => {
      render(<AppearanceTab />);

      expect(screen.getByTestId('theme-edit')).toBeInTheDocument();
      expect(screen.getByTestId('theme-new')).toBeInTheDocument();
      expect(screen.queryByTestId('theme-delete')).not.toBeInTheDocument();
    });

    it('should delete the active custom theme and fall back to modern', async () => {
      const user = userEvent.setup();
      const id = useSettingsStore.getState().addCustomTheme('Neon', '.sic-msg {}');
      useSettingsStore.setState({ theme: id });

      render(<AppearanceTab />);

      await user.click(screen.getByTestId('theme-delete'));

      expect(useSettingsStore.getState().customThemes[id]).toBeUndefined();
      expect(useSettingsStore.getState().theme).toBe('modern');
    });
  });

  describe('Theme editor', () => {
    // The Edit / New theme buttons open the Creator; its "Edit CSS" button
    // switches to the CSS editor
    const openCssEditor = async (user: ReturnType<typeof userEvent.setup>, buttonTestId: 'theme-edit' | 'theme-new') => {
      await user.click(screen.getByTestId(buttonTestId));
      await user.click(screen.getByTestId('creator-edit-css'));
    };

    it('should open the editor with the active theme CSS and save edits as a builtin override', async () => {
      const user = userEvent.setup();

      render(<AppearanceTab />);

      await openCssEditor(user, 'theme-edit');

      const editor = screen.getByTestId('codemirror-mock') as HTMLTextAreaElement;
      expect(editor.value).toContain('.sic-msg');
      // Builtin theme names are not editable
      expect(screen.getByTestId('theme-name')).toBeDisabled();

      fireEvent.change(editor, { target: { value: '.sic-msg { color: red; }' } });
      await user.click(screen.getByTestId('theme-save'));

      expect(useSettingsStore.getState().builtinThemeOverrides.modern).toBe('.sic-msg { color: red; }');
    });

    it('should reset a builtin theme to its shipped CSS', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ builtinThemeOverrides: { modern: '.custom {}' } });

      render(<AppearanceTab />);

      await openCssEditor(user, 'theme-edit');

      const editor = screen.getByTestId('codemirror-mock') as HTMLTextAreaElement;
      expect(editor.value).toBe('.custom {}');

      await user.click(screen.getByTestId('theme-reset'));
      await user.click(screen.getByTestId('theme-save'));

      // Saving the shipped default clears the override entirely
      expect(useSettingsStore.getState().builtinThemeOverrides.modern).toBeUndefined();
    });

    it('should create a new custom theme seeded from the active theme and activate it', async () => {
      const user = userEvent.setup();

      render(<AppearanceTab />);

      await openCssEditor(user, 'theme-new');

      const nameInput = screen.getByTestId('theme-name') as HTMLInputElement;
      expect(nameInput).not.toBeDisabled();
      fireEvent.change(nameInput, { target: { value: 'My neon theme' } });

      const editor = screen.getByTestId('codemirror-mock') as HTMLTextAreaElement;
      expect(editor.value).toContain('.sic-msg');
      fireEvent.change(editor, { target: { value: '.sic-msg { background: black; }' } });

      await user.click(screen.getByTestId('theme-save'));

      const { theme, customThemes } = useSettingsStore.getState();
      expect(customThemes[theme]).toEqual({ name: 'My neon theme', css: '.sic-msg { background: black; }' });
    });

    it('should edit an existing custom theme', async () => {
      const user = userEvent.setup();
      const id = useSettingsStore.getState().addCustomTheme('Neon', '.sic-msg { color: lime; }');
      useSettingsStore.setState({ theme: id });

      render(<AppearanceTab />);

      await openCssEditor(user, 'theme-edit');

      const editor = screen.getByTestId('codemirror-mock') as HTMLTextAreaElement;
      expect(editor.value).toBe('.sic-msg { color: lime; }');
      // No reset button for custom themes
      expect(screen.queryByTestId('theme-reset')).not.toBeInTheDocument();

      fireEvent.change(editor, { target: { value: '.sic-msg { color: cyan; }' } });
      await user.click(screen.getByTestId('theme-save'));

      expect(useSettingsStore.getState().customThemes[id]?.css).toBe('.sic-msg { color: cyan; }');
    });

    it('should not persist changes when cancelled', async () => {
      const user = userEvent.setup();

      render(<AppearanceTab />);

      await openCssEditor(user, 'theme-edit');

      const editor = screen.getByTestId('codemirror-mock') as HTMLTextAreaElement;
      fireEvent.change(editor, { target: { value: '.sic-msg { color: red; }' } });
      await user.click(screen.getByTestId('theme-cancel'));

      expect(useSettingsStore.getState().builtinThemeOverrides.modern).toBeUndefined();
    });

    it('should carry unsaved Creator changes into the CSS editor', async () => {
      const user = userEvent.setup();

      render(<AppearanceTab />);

      await user.click(screen.getByTestId('theme-new'));
      fireEvent.change(screen.getByTestId('creator-theme-name'), { target: { value: 'Draft theme' } });
      fireEvent.change(screen.getByTestId('creator-color-light-join'), { target: { value: '#123456' } });
      await user.click(screen.getByTestId('creator-edit-css'));

      const editor = screen.getByTestId('codemirror-mock') as HTMLTextAreaElement;
      expect(editor.value).toContain('sic-creator:1');
      expect(editor.value).toContain('--msg-join: #123456;');
      expect((screen.getByTestId('theme-name') as HTMLInputElement).value).toBe('Draft theme');

      await user.click(screen.getByTestId('theme-save'));

      const { theme, customThemes } = useSettingsStore.getState();
      expect(customThemes[theme]?.name).toBe('Draft theme');
      expect(customThemes[theme]?.css).toContain('--msg-join: #123456;');
    });
  });

  describe('Theme creator', () => {
    it('should open the Creator from the Edit and New theme buttons', async () => {
      const user = userEvent.setup();

      render(<AppearanceTab />);

      await user.click(screen.getByTestId('theme-edit'));
      expect(screen.getByTestId('creator-save')).toBeInTheDocument();
      await user.click(screen.getByTestId('creator-cancel'));

      await user.click(screen.getByTestId('theme-new'));
      expect(screen.getByTestId('creator-save')).toBeInTheDocument();
    });

    it('should create a custom theme from creator settings and activate it', async () => {
      const user = userEvent.setup();

      render(<AppearanceTab />);

      await user.click(screen.getByTestId('theme-new'));

      fireEvent.change(screen.getByTestId('creator-theme-name'), { target: { value: 'Creator theme' } });
      await user.click(screen.getByTestId('creator-base-classic'));
      await user.click(screen.getByTestId('creator-compact'));
      fireEvent.change(screen.getByTestId('creator-color-light-join'), { target: { value: '#123456' } });
      await user.click(screen.getByTestId('creator-save'));

      const { theme, customThemes } = useSettingsStore.getState();
      const created = customThemes[theme];
      expect(created?.name).toBe('Creator theme');
      expect(created?.css).toContain('sic-creator:1');
      expect(created?.css).toContain('--msg-join: #123456;');
      expect(created?.css).toContain('padding-top: 0; padding-bottom: 0;');
    });

    it('should create a theme on the irc base with the irc palette and no avatar toggle', async () => {
      const user = userEvent.setup();

      render(<AppearanceTab />);

      await user.click(screen.getByTestId('theme-new'));

      fireEvent.change(screen.getByTestId('creator-theme-name'), { target: { value: 'IRC based' } });
      await user.click(screen.getByTestId('creator-base-irc'));
      expect(screen.getByTestId('creator-base-irc')).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByTestId('creator-show-avatars')).toBeDisabled();
      // Untouched colors follow the base's own palette
      expect(screen.getByTestId('creator-color-light-join')).toHaveValue(IRC_LIGHT_COLORS.join);
      await user.click(screen.getByTestId('creator-save'));

      const { theme, customThemes } = useSettingsStore.getState();
      const created = customThemes[theme];
      expect(created?.css).toContain(BUILTIN_LAYOUT_CSS.irc.trimEnd());
      expect(created?.css).toContain(`--msg-join: ${IRC_DARK_COLORS.join};`);
    });

    it('should edit a builtin theme with the creator and save it as an override', async () => {
      const user = userEvent.setup();

      render(<AppearanceTab />);

      await user.click(screen.getByTestId('theme-edit'));

      // Editing a builtin's shipped CSS should not warn about overwriting
      expect(screen.queryByTestId('creator-overwrite-warning')).not.toBeInTheDocument();
      expect(screen.getByTestId('creator-theme-name')).toBeDisabled();

      await user.click(screen.getByTestId('creator-tab-dark'));
      fireEvent.change(screen.getByTestId('creator-color-dark-error'), { target: { value: '#ff00ff' } });
      await user.click(screen.getByTestId('creator-save'));

      const override = useSettingsStore.getState().builtinThemeOverrides.modern;
      expect(override).toContain('--msg-error: #ff00ff;');
    });

    it('should restore creator settings when re-opening a creator-made theme', async () => {
      const user = userEvent.setup();

      render(<AppearanceTab />);

      // Create with a non-default toggle
      await user.click(screen.getByTestId('theme-new'));
      await user.click(screen.getByTestId('creator-show-seconds'));
      await user.click(screen.getByTestId('creator-save'));

      // Re-open: the toggle state comes back from the CSS marker
      await user.click(screen.getByTestId('theme-edit'));
      expect(screen.getByTestId('creator-show-seconds')).toHaveAttribute('data-state', 'checked');
      expect(screen.queryByTestId('creator-overwrite-warning')).not.toBeInTheDocument();
    });

    it('should warn before overwriting hand-written CSS', async () => {
      const user = userEvent.setup();
      const id = useSettingsStore.getState().addCustomTheme('Handmade', '.sic-msg { color: red; }');
      useSettingsStore.setState({ theme: id });

      render(<AppearanceTab />);

      await user.click(screen.getByTestId('theme-edit'));

      expect(screen.getByTestId('creator-overwrite-warning')).toBeInTheDocument();
    });

    it('should disable the avatar toggle for the classic base', async () => {
      const user = userEvent.setup();

      render(<AppearanceTab />);

      await user.click(screen.getByTestId('theme-new'));

      expect(screen.getByTestId('creator-show-avatars')).not.toBeDisabled();
      await user.click(screen.getByTestId('creator-base-classic'));
      expect(screen.getByTestId('creator-show-avatars')).toBeDisabled();
    });
  });

  describe('Hide avatars toggle', () => {
    it('should render hide avatars toggle', () => {
      render(<AppearanceTab />);

      expect(screen.getByTestId('hide-avatars-toggle')).toBeInTheDocument();
    });

    it('should display translated hide avatars label', () => {
      render(<AppearanceTab />);

      expect(document.body.textContent).toContain('profileSettings.hideAvatars');
    });

    it('should show unchecked state when hideAvatarsInUsersList is false', () => {
      useSettingsStore.setState({ hideAvatarsInUsersList: false });

      render(<AppearanceTab />);

      const toggle = screen.getByTestId('hide-avatars-toggle');
      expect(toggle).toHaveAttribute('data-state', 'unchecked');
    });

    it('should show checked state when hideAvatarsInUsersList is true', () => {
      useSettingsStore.setState({ hideAvatarsInUsersList: true });

      render(<AppearanceTab />);

      const toggle = screen.getByTestId('hide-avatars-toggle');
      expect(toggle).toHaveAttribute('data-state', 'checked');
    });

    it('should toggle hideAvatarsInUsersList when clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ hideAvatarsInUsersList: false });

      render(<AppearanceTab />);

      const toggle = screen.getByTestId('hide-avatars-toggle');
      await user.click(toggle);

      expect(useSettingsStore.getState().hideAvatarsInUsersList).toBe(true);
    });

    it('should toggle hideAvatarsInUsersList from true to false when clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ hideAvatarsInUsersList: true });

      render(<AppearanceTab />);

      const toggle = screen.getByTestId('hide-avatars-toggle');
      await user.click(toggle);

      expect(useSettingsStore.getState().hideAvatarsInUsersList).toBe(false);
    });
  });

  describe('Hide typing indicator toggle', () => {
    it('should render hide typing toggle', () => {
      render(<AppearanceTab />);

      expect(screen.getByTestId('hide-typing-toggle')).toBeInTheDocument();
    });

    it('should display translated hide typing label', () => {
      render(<AppearanceTab />);

      expect(document.body.textContent).toContain('profileSettings.hideTyping');
    });

    it('should show unchecked state when hideTypingIndicator is false', () => {
      useSettingsStore.setState({ hideTypingIndicator: false });

      render(<AppearanceTab />);

      const toggle = screen.getByTestId('hide-typing-toggle');
      expect(toggle).toHaveAttribute('data-state', 'unchecked');
    });

    it('should show checked state when hideTypingIndicator is true', () => {
      useSettingsStore.setState({ hideTypingIndicator: true });

      render(<AppearanceTab />);

      const toggle = screen.getByTestId('hide-typing-toggle');
      expect(toggle).toHaveAttribute('data-state', 'checked');
    });

    it('should toggle hideTypingIndicator when clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ hideTypingIndicator: false });

      render(<AppearanceTab />);

      const toggle = screen.getByTestId('hide-typing-toggle');
      await user.click(toggle);

      expect(useSettingsStore.getState().hideTypingIndicator).toBe(true);
    });

    it('should toggle hideTypingIndicator from true to false when clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ hideTypingIndicator: true });

      render(<AppearanceTab />);

      const toggle = screen.getByTestId('hide-typing-toggle');
      await user.click(toggle);

      expect(useSettingsStore.getState().hideTypingIndicator).toBe(false);
    });
  });

  describe('Font size picker', () => {
    it('should render font size buttons', () => {
      render(<AppearanceTab />);

      expect(screen.getByTestId('font-size-small')).toBeInTheDocument();
      expect(screen.getByTestId('font-size-medium')).toBeInTheDocument();
      expect(screen.getByTestId('font-size-large')).toBeInTheDocument();
    });

    it('should display translated font size labels', () => {
      render(<AppearanceTab />);

      expect(document.body.textContent).toContain('profileSettings.fontSize');
      expect(document.body.textContent).toContain('profileSettings.fontSizeSmall');
      expect(document.body.textContent).toContain('profileSettings.fontSizeMedium');
      expect(document.body.textContent).toContain('profileSettings.fontSizeLarge');
    });

    it('should show Medium as selected when fontSize is medium', () => {
      useSettingsStore.setState({ fontSize: 'medium' });

      render(<AppearanceTab />);

      const smallButton = screen.getByTestId('font-size-small');
      const mediumButton = screen.getByTestId('font-size-medium');
      const largeButton = screen.getByTestId('font-size-large');

      // Medium should have default variant (not outline)
      expect(mediumButton).not.toHaveClass('border-input');
      expect(smallButton).toHaveClass('border-input');
      expect(largeButton).toHaveClass('border-input');
    });

    it('should show Small as selected when fontSize is small', () => {
      useSettingsStore.setState({ fontSize: 'small' });

      render(<AppearanceTab />);

      const smallButton = screen.getByTestId('font-size-small');
      const mediumButton = screen.getByTestId('font-size-medium');
      const largeButton = screen.getByTestId('font-size-large');

      // Small should have default variant (not outline)
      expect(smallButton).not.toHaveClass('border-input');
      expect(mediumButton).toHaveClass('border-input');
      expect(largeButton).toHaveClass('border-input');
    });

    it('should show Large as selected when fontSize is large', () => {
      useSettingsStore.setState({ fontSize: 'large' });

      render(<AppearanceTab />);

      const smallButton = screen.getByTestId('font-size-small');
      const mediumButton = screen.getByTestId('font-size-medium');
      const largeButton = screen.getByTestId('font-size-large');

      // Large should have default variant (not outline)
      expect(largeButton).not.toHaveClass('border-input');
      expect(smallButton).toHaveClass('border-input');
      expect(mediumButton).toHaveClass('border-input');
    });

    it('should switch to small font size when Small button is clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ fontSize: 'medium' });

      render(<AppearanceTab />);

      const smallButton = screen.getByTestId('font-size-small');
      await user.click(smallButton);

      expect(useSettingsStore.getState().fontSize).toBe('small');
    });

    it('should switch to medium font size when Medium button is clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ fontSize: 'small' });

      render(<AppearanceTab />);

      const mediumButton = screen.getByTestId('font-size-medium');
      await user.click(mediumButton);

      expect(useSettingsStore.getState().fontSize).toBe('medium');
    });

    it('should switch to large font size when Large button is clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ fontSize: 'medium' });

      render(<AppearanceTab />);

      const largeButton = screen.getByTestId('font-size-large');
      await user.click(largeButton);

      expect(useSettingsStore.getState().fontSize).toBe('large');
    });
  });
});
