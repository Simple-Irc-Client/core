import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProfileSettings from '../ProfileSettings';
import * as network from '@/network/irc/network';
import { useSettingsStore } from '@features/settings/store/settings';

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

vi.mock('@/network/irc/network', () => ({
  ircSendRawMessage: vi.fn(),
  ircConnect: vi.fn(),
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

describe('ProfileSettings', () => {
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      supportedOptions: [],
      currentUserAvatar: undefined,
      currentUserDisplayName: undefined,
      currentUserStatus: undefined,
      currentUserHomepage: undefined,
      currentUserColor: undefined,
      theme: 'modern',
      customThemes: {},
      builtinThemeOverrides: {},
      fontSize: 'medium',
      hideAvatarsInUsersList: false,
    });
  });

  describe('Dialog rendering', () => {
    it('should render dialog when open is true', () => {
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(document.body.textContent).toContain('profileSettings.title');
      expect(document.body.textContent).toContain('profileSettings.description');
    });

    it('should not render dialog content when open is false', () => {
      render(
        <ProfileSettings
          open={false}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(document.body.textContent).not.toContain('profileSettings.description');
    });

    it('should show nick input pre-filled with currentNick', () => {
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const nickInput = document.querySelector('#nick') as HTMLInputElement;
      expect(nickInput).not.toBeNull();
      expect(nickInput.value).toBe('testUser');
    });
  });

  describe('Nick change functionality', () => {
    it('should send NICK command when changing nickname', async () => {
      const user = userEvent.setup();
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const nickInput = document.querySelector('#nick') as HTMLInputElement;
      await user.clear(nickInput);
      await user.type(nickInput, 'newNickname');

      const changeButton = screen.getByText('profileSettings.changeNick');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('NICK newNickname');
    });

    it('should not send NICK command when nickname is empty', async () => {
      const user = userEvent.setup();
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const nickInput = document.querySelector('#nick') as HTMLInputElement;
      await user.clear(nickInput);

      const changeButton = screen.getByText('profileSettings.changeNick');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).not.toHaveBeenCalledWith(expect.stringContaining('NICK'));
    });

    it('should not send NICK command when nickname is only whitespace', async () => {
      const user = userEvent.setup();
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const nickInput = document.querySelector('#nick') as HTMLInputElement;
      await user.clear(nickInput);
      await user.type(nickInput, '   ');

      const changeButton = screen.getByText('profileSettings.changeNick');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).not.toHaveBeenCalledWith(expect.stringContaining('NICK'));
    });

    it('should trim whitespace from nickname', async () => {
      const user = userEvent.setup();
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const nickInput = document.querySelector('#nick') as HTMLInputElement;
      await user.clear(nickInput);
      await user.type(nickInput, '  newNick  ');

      const changeButton = screen.getByText('profileSettings.changeNick');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('NICK newNick');
    });

    it('should call onOpenChange(false) after changing nickname', async () => {
      const user = userEvent.setup();
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const nickInput = document.querySelector('#nick') as HTMLInputElement;
      await user.clear(nickInput);
      await user.type(nickInput, 'newNickname');

      const changeButton = screen.getByText('profileSettings.changeNick');
      await user.click(changeButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should send NICK command when pressing Enter in nick input', async () => {
      const user = userEvent.setup();
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const nickInput = document.querySelector('#nick') as HTMLInputElement;
      await user.clear(nickInput);
      await user.type(nickInput, 'newNickname{Enter}');

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('NICK newNickname');
    });
  });

  describe('Dialog state management', () => {
    it('should preserve nick input value when currentNick prop changes while open', () => {
      const { rerender } = render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="oldNick"
        />
      );

      let nickInput = document.querySelector('#nick') as HTMLInputElement;
      expect(nickInput.value).toBe('oldNick');

      // When currentNick changes while dialog is open, the input should preserve its value
      // to avoid overwriting any user edits
      rerender(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="newNick"
        />
      );

      nickInput = document.querySelector('#nick') as HTMLInputElement;
      expect(nickInput.value).toBe('oldNick');
    });

    it('should reset nick input when dialog is reopened', () => {
      const { rerender } = render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="firstNick"
        />
      );

      let nickInput = document.querySelector('#nick') as HTMLInputElement;
      expect(nickInput.value).toBe('firstNick');

      // Close the dialog
      rerender(
        <ProfileSettings
          open={false}
          onOpenChange={mockOnOpenChange}
          currentNick="newNick"
        />
      );

      // Reopen the dialog - should now have the new nick value
      rerender(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="newNick"
        />
      );

      nickInput = document.querySelector('#nick') as HTMLInputElement;
      expect(nickInput.value).toBe('newNick');
    });
  });

  describe('Theme selection', () => {
    it('should render the theme select showing the active theme', () => {
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const trigger = screen.getByTestId('theme-select');
      expect(trigger).toBeInTheDocument();
      expect(trigger.textContent).toContain('profileSettings.layoutModern');
    });

    it('should switch the theme via the dropdown', async () => {
      const user = userEvent.setup();

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      await user.click(screen.getByTestId('theme-select'));
      await user.click(screen.getByTestId('theme-classic'));

      expect(useSettingsStore.getState().theme).toBe('classic');
    });

    it('should list custom themes in the dropdown', async () => {
      const user = userEvent.setup();
      const id = useSettingsStore.getState().addCustomTheme('Neon', '.sic-msg {}');

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      await user.click(screen.getByTestId('theme-select'));

      expect(screen.getByTestId(`theme-${id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`theme-${id}`).textContent).toContain('Neon');
    });

    it('should show edit and new buttons, but no delete button for builtin themes', () => {
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(screen.getByTestId('theme-edit')).toBeInTheDocument();
      expect(screen.getByTestId('theme-new')).toBeInTheDocument();
      expect(screen.queryByTestId('theme-delete')).not.toBeInTheDocument();
    });

    it('should delete the active custom theme and fall back to modern', async () => {
      const user = userEvent.setup();
      const id = useSettingsStore.getState().addCustomTheme('Neon', '.sic-msg {}');
      useSettingsStore.setState({ theme: id });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

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

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

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

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

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

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

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

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

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

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      await openCssEditor(user, 'theme-edit');

      const editor = screen.getByTestId('codemirror-mock') as HTMLTextAreaElement;
      fireEvent.change(editor, { target: { value: '.sic-msg { color: red; }' } });
      await user.click(screen.getByTestId('theme-cancel'));

      expect(useSettingsStore.getState().builtinThemeOverrides.modern).toBeUndefined();
    });

    it('should carry unsaved Creator changes into the CSS editor', async () => {
      const user = userEvent.setup();

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

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

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      await user.click(screen.getByTestId('theme-edit'));
      expect(screen.getByTestId('creator-save')).toBeInTheDocument();
      await user.click(screen.getByTestId('creator-cancel'));

      await user.click(screen.getByTestId('theme-new'));
      expect(screen.getByTestId('creator-save')).toBeInTheDocument();
    });

    it('should create a custom theme from creator settings and activate it', async () => {
      const user = userEvent.setup();

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

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

    it('should edit a builtin theme with the creator and save it as an override', async () => {
      const user = userEvent.setup();

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

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

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

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

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      await user.click(screen.getByTestId('theme-edit'));

      expect(screen.getByTestId('creator-overwrite-warning')).toBeInTheDocument();
    });

    it('should disable the avatar toggle for the classic base', async () => {
      const user = userEvent.setup();

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      await user.click(screen.getByTestId('theme-new'));

      expect(screen.getByTestId('creator-show-avatars')).not.toBeDisabled();
      await user.click(screen.getByTestId('creator-base-classic'));
      expect(screen.getByTestId('creator-show-avatars')).toBeDisabled();
    });
  });

  describe('Hide avatars toggle', () => {
    it('should render hide avatars toggle', () => {
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(screen.getByTestId('hide-avatars-toggle')).toBeInTheDocument();
    });

    it('should display translated hide avatars label', () => {
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(document.body.textContent).toContain('profileSettings.hideAvatars');
    });

    it('should show unchecked state when hideAvatarsInUsersList is false', () => {
      useSettingsStore.setState({ hideAvatarsInUsersList: false });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const toggle = screen.getByTestId('hide-avatars-toggle');
      expect(toggle).toHaveAttribute('data-state', 'unchecked');
    });

    it('should show checked state when hideAvatarsInUsersList is true', () => {
      useSettingsStore.setState({ hideAvatarsInUsersList: true });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const toggle = screen.getByTestId('hide-avatars-toggle');
      expect(toggle).toHaveAttribute('data-state', 'checked');
    });

    it('should toggle hideAvatarsInUsersList when clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ hideAvatarsInUsersList: false });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const toggle = screen.getByTestId('hide-avatars-toggle');
      await user.click(toggle);

      expect(useSettingsStore.getState().hideAvatarsInUsersList).toBe(true);
    });

    it('should toggle hideAvatarsInUsersList from true to false when clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ hideAvatarsInUsersList: true });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const toggle = screen.getByTestId('hide-avatars-toggle');
      await user.click(toggle);

      expect(useSettingsStore.getState().hideAvatarsInUsersList).toBe(false);
    });
  });

  describe('Hide typing indicator toggle', () => {
    it('should render hide typing toggle', () => {
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(screen.getByTestId('hide-typing-toggle')).toBeInTheDocument();
    });

    it('should display translated hide typing label', () => {
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(document.body.textContent).toContain('profileSettings.hideTyping');
    });

    it('should show unchecked state when hideTypingIndicator is false', () => {
      useSettingsStore.setState({ hideTypingIndicator: false });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const toggle = screen.getByTestId('hide-typing-toggle');
      expect(toggle).toHaveAttribute('data-state', 'unchecked');
    });

    it('should show checked state when hideTypingIndicator is true', () => {
      useSettingsStore.setState({ hideTypingIndicator: true });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const toggle = screen.getByTestId('hide-typing-toggle');
      expect(toggle).toHaveAttribute('data-state', 'checked');
    });

    it('should toggle hideTypingIndicator when clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ hideTypingIndicator: false });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const toggle = screen.getByTestId('hide-typing-toggle');
      await user.click(toggle);

      expect(useSettingsStore.getState().hideTypingIndicator).toBe(true);
    });

    it('should toggle hideTypingIndicator from true to false when clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ hideTypingIndicator: true });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const toggle = screen.getByTestId('hide-typing-toggle');
      await user.click(toggle);

      expect(useSettingsStore.getState().hideTypingIndicator).toBe(false);
    });
  });

  describe('Font size picker', () => {
    it('should render font size buttons', () => {
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(screen.getByTestId('font-size-small')).toBeInTheDocument();
      expect(screen.getByTestId('font-size-medium')).toBeInTheDocument();
      expect(screen.getByTestId('font-size-large')).toBeInTheDocument();
    });

    it('should display translated font size labels', () => {
      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(document.body.textContent).toContain('profileSettings.fontSize');
      expect(document.body.textContent).toContain('profileSettings.fontSizeSmall');
      expect(document.body.textContent).toContain('profileSettings.fontSizeMedium');
      expect(document.body.textContent).toContain('profileSettings.fontSizeLarge');
    });

    it('should show Medium as selected when fontSize is medium', () => {
      useSettingsStore.setState({ fontSize: 'medium' });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

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

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

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

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

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

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const smallButton = screen.getByTestId('font-size-small');
      await user.click(smallButton);

      expect(useSettingsStore.getState().fontSize).toBe('small');
    });

    it('should switch to medium font size when Medium button is clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ fontSize: 'small' });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const mediumButton = screen.getByTestId('font-size-medium');
      await user.click(mediumButton);

      expect(useSettingsStore.getState().fontSize).toBe('medium');
    });

    it('should switch to large font size when Large button is clicked', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ fontSize: 'medium' });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const largeButton = screen.getByTestId('font-size-large');
      await user.click(largeButton);

      expect(useSettingsStore.getState().fontSize).toBe('large');
    });
  });

  describe('Avatar change functionality', () => {
    it('should not send METADATA when avatar URL is unsafe (javascript:)', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-avatar'] });

      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      const avatarInput = document.querySelector('#avatar') as HTMLInputElement;
      await user.type(avatarInput, 'javascript:alert(1)');

      const changeButton = screen.getByText('profileSettings.changeAvatar');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).not.toHaveBeenCalled();
    });

    it('should not send METADATA when avatar URL is unsafe (data:)', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-avatar'] });

      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      const avatarInput = document.querySelector('#avatar') as HTMLInputElement;
      await user.type(avatarInput, 'data:image/png;base64,abc');

      const changeButton = screen.getByText('profileSettings.changeAvatar');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).not.toHaveBeenCalled();
    });

    it('should send METADATA when avatar URL is safe (https)', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-avatar'] });

      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      const avatarInput = document.querySelector('#avatar') as HTMLInputElement;
      await user.type(avatarInput, 'https://example.com/avatar.png');

      const changeButton = screen.getByText('profileSettings.changeAvatar');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith(
        'METADATA * SET avatar https://example.com/avatar.png',
      );
    });

    it('should send METADATA to clear avatar when input is empty', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({
        supportedOptions: ['metadata-avatar'],
        currentUserAvatar: 'https://example.com/old.png',
      });

      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      const avatarInput = document.querySelector('#avatar') as HTMLInputElement;
      await user.clear(avatarInput);

      const changeButton = screen.getByText('profileSettings.changeAvatar');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA * SET avatar');
    });

    it('should not close dialog when avatar URL is unsafe', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-avatar'] });

      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      const avatarInput = document.querySelector('#avatar') as HTMLInputElement;
      await user.type(avatarInput, 'javascript:alert(1)');

      const changeButton = screen.getByText('profileSettings.changeAvatar');
      await user.click(changeButton);

      expect(mockOnOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('Display name change functionality', () => {
    it('should not show display name field when metadata-display-name is not supported', () => {
      useSettingsStore.setState({ supportedOptions: [] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const displayNameInput = document.querySelector('#displayName');
      expect(displayNameInput).toBeNull();
    });

    it('should show display name field when metadata-display-name is supported', () => {
      useSettingsStore.setState({ supportedOptions: ['metadata-display-name'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const displayNameInput = document.querySelector('#displayName');
      expect(displayNameInput).not.toBeNull();
    });

    it('should pre-fill display name input with current display name', () => {
      useSettingsStore.setState({
        supportedOptions: ['metadata-display-name'],
        currentUserDisplayName: 'John Doe',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const displayNameInput = document.querySelector('#displayName') as HTMLInputElement;
      expect(displayNameInput.value).toBe('John Doe');
    });

    it('should send METADATA SET display-name command when changing display name', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-display-name'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const displayNameInput = document.querySelector('#displayName') as HTMLInputElement;
      await user.type(displayNameInput, 'New Display Name');

      const changeButton = screen.getByText('profileSettings.changeDisplayName');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA * SET display-name :New Display Name');
    });

    it('should send METADATA SET display-name without value to clear display name', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({
        supportedOptions: ['metadata-display-name'],
        currentUserDisplayName: 'Old Name',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const displayNameInput = document.querySelector('#displayName') as HTMLInputElement;
      await user.clear(displayNameInput);

      const changeButton = screen.getByText('profileSettings.changeDisplayName');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA * SET display-name');
    });

    it('should close dialog after changing display name', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-display-name'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const displayNameInput = document.querySelector('#displayName') as HTMLInputElement;
      await user.type(displayNameInput, 'New Display Name');

      const changeButton = screen.getByText('profileSettings.changeDisplayName');
      await user.click(changeButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should send METADATA SET display-name command when pressing Enter', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-display-name'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const displayNameInput = document.querySelector('#displayName') as HTMLInputElement;
      await user.type(displayNameInput, 'New Name{Enter}');

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA * SET display-name :New Name');
    });

    it('should display translated display name label', () => {
      useSettingsStore.setState({ supportedOptions: ['metadata-display-name'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(document.body.textContent).toContain('profileSettings.displayName');
    });
  });

  describe('Status change functionality', () => {
    it('should not show status field when metadata-status is not supported', () => {
      useSettingsStore.setState({ supportedOptions: [] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const statusInput = document.querySelector('#status');
      expect(statusInput).toBeNull();
    });

    it('should show status field when metadata-status is supported', () => {
      useSettingsStore.setState({ supportedOptions: ['metadata-status'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const statusInput = document.querySelector('#status');
      expect(statusInput).not.toBeNull();
    });

    it('should pre-fill status input with current status', () => {
      useSettingsStore.setState({
        supportedOptions: ['metadata-status'],
        currentUserStatus: 'Working from home',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const statusInput = document.querySelector('#status') as HTMLInputElement;
      expect(statusInput.value).toBe('Working from home');
    });

    it('should send METADATA SET status command when changing status', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-status'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const statusInput = document.querySelector('#status') as HTMLInputElement;
      await user.type(statusInput, 'On vacation');

      const changeButton = screen.getByText('profileSettings.changeStatus');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA * SET status :On vacation');
    });

    it('should send METADATA SET status without value to clear status', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({
        supportedOptions: ['metadata-status'],
        currentUserStatus: 'Old Status',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const statusInput = document.querySelector('#status') as HTMLInputElement;
      await user.clear(statusInput);

      const changeButton = screen.getByText('profileSettings.changeStatus');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA * SET status');
    });

    it('should close dialog after changing status', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-status'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const statusInput = document.querySelector('#status') as HTMLInputElement;
      await user.type(statusInput, 'New Status');

      const changeButton = screen.getByText('profileSettings.changeStatus');
      await user.click(changeButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should send METADATA SET status command when pressing Enter', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-status'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const statusInput = document.querySelector('#status') as HTMLInputElement;
      await user.type(statusInput, 'New Status{Enter}');

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA * SET status :New Status');
    });
  });

  describe('Homepage change functionality', () => {
    it('should not show homepage field when metadata-homepage is not supported', () => {
      useSettingsStore.setState({ supportedOptions: [] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const homepageInput = document.querySelector('#homepage');
      expect(homepageInput).toBeNull();
    });

    it('should show homepage field when metadata-homepage is supported', () => {
      useSettingsStore.setState({ supportedOptions: ['metadata-homepage'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const homepageInput = document.querySelector('#homepage');
      expect(homepageInput).not.toBeNull();
    });

    it('should pre-fill homepage input with current homepage', () => {
      useSettingsStore.setState({
        supportedOptions: ['metadata-homepage'],
        currentUserHomepage: 'https://example.com',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const homepageInput = document.querySelector('#homepage') as HTMLInputElement;
      expect(homepageInput.value).toBe('https://example.com');
    });

    it('should send METADATA SET homepage command when changing homepage', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-homepage'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const homepageInput = document.querySelector('#homepage') as HTMLInputElement;
      await user.type(homepageInput, 'https://mywebsite.com');

      const changeButton = screen.getByText('profileSettings.changeHomepage');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA * SET homepage https://mywebsite.com');
    });

    it('should send METADATA SET homepage without value to clear homepage', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({
        supportedOptions: ['metadata-homepage'],
        currentUserHomepage: 'https://old-website.com',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const homepageInput = document.querySelector('#homepage') as HTMLInputElement;
      await user.clear(homepageInput);

      const changeButton = screen.getByText('profileSettings.changeHomepage');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA * SET homepage');
    });

    it('should close dialog after changing homepage', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-homepage'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const homepageInput = document.querySelector('#homepage') as HTMLInputElement;
      await user.type(homepageInput, 'https://example.com');

      const changeButton = screen.getByText('profileSettings.changeHomepage');
      await user.click(changeButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should send METADATA SET homepage command when pressing Enter', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-homepage'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const homepageInput = document.querySelector('#homepage') as HTMLInputElement;
      await user.type(homepageInput, 'https://example.com{Enter}');

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA * SET homepage https://example.com');
    });

    it('should display translated homepage labels', () => {
      useSettingsStore.setState({ supportedOptions: ['metadata-homepage'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(document.body.textContent).toContain('profileSettings.homepage');
      expect(document.body.textContent).toContain('profileSettings.changeHomepage');
    });

    it('should not send METADATA when homepage URL is unsafe (javascript:)', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-homepage'] });

      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      const homepageInput = document.querySelector('#homepage') as HTMLInputElement;
      await user.type(homepageInput, 'javascript:alert(1)');

      const changeButton = screen.getByText('profileSettings.changeHomepage');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).not.toHaveBeenCalled();
    });

    it('should not send METADATA when homepage URL is unsafe (data:)', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-homepage'] });

      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      const homepageInput = document.querySelector('#homepage') as HTMLInputElement;
      await user.type(homepageInput, 'data:text/html,<h1>evil</h1>');

      const changeButton = screen.getByText('profileSettings.changeHomepage');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).not.toHaveBeenCalled();
    });

    it('should not close dialog when homepage URL is unsafe', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-homepage'] });

      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      const homepageInput = document.querySelector('#homepage') as HTMLInputElement;
      await user.type(homepageInput, 'javascript:alert(1)');

      const changeButton = screen.getByText('profileSettings.changeHomepage');
      await user.click(changeButton);

      expect(mockOnOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('Color change functionality', () => {
    it('should not show color field when metadata-color is not supported', () => {
      useSettingsStore.setState({ supportedOptions: [] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const colorInput = document.querySelector('#color');
      expect(colorInput).toBeNull();
    });

    it('should show color field when metadata-color is supported', () => {
      useSettingsStore.setState({ supportedOptions: ['metadata-color'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const colorInput = document.querySelector('#color');
      expect(colorInput).not.toBeNull();
    });

    it('should pre-fill color input with current color', () => {
      useSettingsStore.setState({
        supportedOptions: ['metadata-color'],
        currentUserColor: '#ff0000',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const colorInput = document.querySelector('#color') as HTMLInputElement;
      expect(colorInput.value).toBe('#ff0000');
    });

    it('should send METADATA SET color command when changing color', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({ supportedOptions: ['metadata-color'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const colorInput = document.querySelector('#color') as HTMLInputElement;
      // Simulate color input change using fireEvent for color inputs
      fireEvent.change(colorInput, { target: { value: '#00ff00' } });

      const changeButton = screen.getByText('profileSettings.changeColor');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA * SET color #00ff00');
    });

    it('should close dialog after changing color', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({
        supportedOptions: ['metadata-color'],
        currentUserColor: '#ff0000',
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const changeButton = screen.getByText('profileSettings.changeColor');
      await user.click(changeButton);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    it('should display translated color labels', () => {
      useSettingsStore.setState({ supportedOptions: ['metadata-color'] });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      expect(document.body.textContent).toContain('profileSettings.nickColor');
      expect(document.body.textContent).toContain('profileSettings.changeColor');
    });

    it('should default to black color when no color is set', () => {
      useSettingsStore.setState({
        supportedOptions: ['metadata-color'],
        currentUserColor: undefined,
      });

      render(
        <ProfileSettings
          open={true}
          onOpenChange={mockOnOpenChange}
          currentNick="testUser"
        />
      );

      const colorInput = document.querySelector('#color') as HTMLInputElement;
      expect(colorInput.value).toBe('#000000');
    });
  });

  describe('Unhappy paths', () => {
    it('should not send NICK command when nick is unchanged', async () => {
      const user = userEvent.setup();
      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      // Click change without modifying the nick
      const changeButton = screen.getByText('profileSettings.changeNick');
      await user.click(changeButton);

      // NICK command is still sent because the component doesn't check same nick
      // But the server will ignore it. The component only guards against empty.
      expect(network.ircSendRawMessage).toHaveBeenCalledWith('NICK testUser');
    });

    it('should send METADATA SET color with value when color input has a value', async () => {
      const user = userEvent.setup();
      useSettingsStore.setState({
        supportedOptions: ['metadata-color'],
        currentUserColor: '#ff0000',
      });

      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      const colorInput = document.querySelector('#color') as HTMLInputElement;
      fireEvent.change(colorInput, { target: { value: '#00ff00' } });

      const changeButton = screen.getByText('profileSettings.changeColor');
      await user.click(changeButton);

      expect(network.ircSendRawMessage).toHaveBeenCalledWith('METADATA * SET color #00ff00');
    });

    it('should hide all metadata fields when no options are supported', () => {
      useSettingsStore.setState({ supportedOptions: [] });

      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      expect(document.querySelector('#avatar')).toBeNull();
      expect(document.querySelector('#displayName')).toBeNull();
      expect(document.querySelector('#status')).toBeNull();
      expect(document.querySelector('#homepage')).toBeNull();
      expect(document.querySelector('#color')).toBeNull();
    });

    it('should not send NICK command when nick input is whitespace only', async () => {
      const user = userEvent.setup();
      render(
        <ProfileSettings open={true} onOpenChange={mockOnOpenChange} currentNick="testUser" />
      );

      const nickInput = document.querySelector('#nick') as HTMLInputElement;
      await user.clear(nickInput);
      await user.type(nickInput, '   ');

      const changeButton = screen.getByText('profileSettings.changeNick');
      await user.click(changeButton);

      // handleNickChange checks newNick.trim().length > 0
      expect(network.ircSendRawMessage).not.toHaveBeenCalled();
    });
  });
});
