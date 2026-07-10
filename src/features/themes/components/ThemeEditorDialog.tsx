import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CodeMirror from '@uiw/react-codemirror';
import { css as cssLang } from '@codemirror/lang-css';
import { useSettingsStore } from '@features/settings/store/settings';
import { BUILTIN_THEMES, isBuiltinTheme } from '../builtinThemes';
import { resolveThemeCss } from '../themeSelectors';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/components/ui/dialog';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { useThemePreview } from './useThemePreview';

interface ThemeEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'edit' | 'create';
  /** Theme being edited; required in 'edit' mode. */
  themeId?: string;
  /** Unsaved draft carried over from the Theme Creator (name + generated CSS). */
  draft?: { name: string; css: string };
}

const ThemeEditorDialog = ({ open, onOpenChange, mode, themeId, draft }: ThemeEditorDialogProps) => {
  const { t } = useTranslation();
  const isDarkMode = useSettingsStore((s) => s.isDarkMode);
  const activeTheme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const addCustomTheme = useSettingsStore((s) => s.addCustomTheme);
  const updateCustomTheme = useSettingsStore((s) => s.updateCustomTheme);
  const setBuiltinThemeCss = useSettingsStore((s) => s.setBuiltinThemeCss);

  const isBuiltin = mode === 'edit' && themeId !== undefined && isBuiltinTheme(themeId);

  const [name, setName] = useState(() => {
    if (draft && !isBuiltin) { return draft.name; }
    if (mode === 'create') { return t('profileSettings.themeNewDefaultName'); }
    if (themeId === undefined) { return ''; }
    if (isBuiltinTheme(themeId)) { return t(BUILTIN_THEMES[themeId].nameKey); }
    return useSettingsStore.getState().customThemes[themeId]?.name ?? '';
  });
  const [css, setCss] = useState(() => {
    if (draft) { return draft.css; }
    const state = useSettingsStore.getState();
    // A new theme starts from the CSS of the currently active theme
    return resolveThemeCss(state, mode === 'create' ? state.theme : (themeId ?? state.theme));
  });

  // Only preview when the edited theme is the one currently shown (a new
  // theme previews too — it becomes active on save)
  useThemePreview(css, mode === 'create' || themeId === activeTheme);

  const handleReset = (): void => {
    if (isBuiltin && themeId !== undefined && isBuiltinTheme(themeId)) {
      setCss(BUILTIN_THEMES[themeId].css);
    }
  };

  const handleSave = (): void => {
    const trimmedName = name.trim();
    if (mode === 'create') {
      if (trimmedName.length === 0) { return; }
      const id = addCustomTheme(trimmedName, css);
      setTheme(id);
    } else if (themeId !== undefined) {
      if (isBuiltinTheme(themeId)) {
        setBuiltinThemeCss(themeId, css);
      } else {
        if (trimmedName.length === 0) { return; }
        updateCustomTheme(themeId, { name: trimmedName, css });
      }
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('profileSettings.themeEditorCreateTitle') : t('profileSettings.themeEditorTitle')}
          </DialogTitle>
          <DialogDescription>{t('profileSettings.themeEditorDescription')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="theme-name" className="text-right">
              {t('profileSettings.themeName')}
            </Label>
            <Input
              id="theme-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              disabled={isBuiltin}
              data-testid="theme-name"
            />
          </div>
          <div className="rounded-md border overflow-hidden" data-testid="theme-css-editor">
            <CodeMirror
              value={css}
              onChange={setCss}
              extensions={[cssLang()]}
              theme={isDarkMode ? 'dark' : 'light'}
              height="55vh"
            />
          </div>
        </div>
        <DialogFooter>
          {isBuiltin && (
            <Button type="button" variant="outline" onClick={handleReset} data-testid="theme-reset">
              {t('profileSettings.themeReset')}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="theme-cancel">
            {t('profileSettings.themeCancel')}
          </Button>
          <Button type="button" onClick={handleSave} data-testid="theme-save">
            {t('profileSettings.themeSave')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ThemeEditorDialog;
