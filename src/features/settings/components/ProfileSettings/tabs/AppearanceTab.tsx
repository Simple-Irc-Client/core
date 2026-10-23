import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/app/i18n';
import { languages, type LanguageSetting } from '@/config/languages';
import { type FontSize, useSettingsStore } from '@features/settings/store/settings';
import { isBuiltinTheme } from '@features/themes/builtinThemes';
import { getThemeList } from '@features/themes/themeSelectors';
import ThemeEditorDialog from '@features/themes/components/ThemeEditorDialog';
import ThemeCreatorDialog from '@features/themes/components/ThemeCreatorDialog';
import { Button } from '@shared/components/ui/button';
import { Label } from '@shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Switch } from '@shared/components/ui/switch';
import { cn } from '@shared/lib/utils';
import { SETTING_LABEL, SETTING_ROW, SETTINGS_GRID } from '../../settingsLayout';

const FONT_SIZES: { size: FontSize; label: string }[] = [
  { size: 'small', label: 'profileSettings.fontSizeSmall' },
  { size: 'medium', label: 'profileSettings.fontSizeMedium' },
  { size: 'large', label: 'profileSettings.fontSizeLarge' },
];

const AppearanceTab = () => {
  const { t } = useTranslation();
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const customThemes = useSettingsStore((state) => state.customThemes);
  const builtinThemeOverrides = useSettingsStore((state) => state.builtinThemeOverrides);
  const deleteCustomTheme = useSettingsStore((state) => state.deleteCustomTheme);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const setFontSize = useSettingsStore((state) => state.setFontSize);
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const hideAvatarsInUsersList = useSettingsStore((state) => state.hideAvatarsInUsersList);
  const setHideAvatarsInUsersList = useSettingsStore((state) => state.setHideAvatarsInUsersList);
  const hideTypingIndicator = useSettingsStore((state) => state.hideTypingIndicator);
  const setHideTypingIndicator = useSettingsStore((state) => state.setHideTypingIndicator);
  const [themeDialog, setThemeDialog] = useState<{
    kind: 'editor' | 'creator';
    mode: 'edit' | 'create';
    draft?: { name: string; css: string };
  } | null>(null);

  return (
    <div className={SETTINGS_GRID}>
      <div className={SETTING_ROW}>
        <Label id="theme-label" className={SETTING_LABEL}>
          {t('profileSettings.theme')}
        </Label>
        <div className="col-span-full grid gap-2 sm:col-span-3">
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger data-testid="theme-select" aria-labelledby="theme-label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getThemeList({ theme, customThemes, builtinThemeOverrides }, t).map(({ id, name }) => (
                <SelectItem key={id} value={id} data-testid={`theme-${id}`}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setThemeDialog({ kind: 'creator', mode: 'edit' })}
              data-testid="theme-edit"
            >
              {t('profileSettings.themeEdit')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setThemeDialog({ kind: 'creator', mode: 'create' })}
              data-testid="theme-new"
            >
              {t('profileSettings.themeNew')}
            </Button>
            {!isBuiltinTheme(theme) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => deleteCustomTheme(theme)}
                data-testid="theme-delete"
              >
                {t('profileSettings.themeDelete')}
              </Button>
            )}
          </div>
        </div>
      </div>
      {themeDialog?.kind === 'editor' && (
        <ThemeEditorDialog
          open
          onOpenChange={(isOpen) => { if (!isOpen) { setThemeDialog(null); } }}
          mode={themeDialog.mode}
          themeId={themeDialog.mode === 'edit' ? theme : undefined}
          draft={themeDialog.draft}
        />
      )}
      {themeDialog?.kind === 'creator' && (
        <ThemeCreatorDialog
          open
          onOpenChange={(isOpen) => { if (!isOpen) { setThemeDialog(null); } }}
          mode={themeDialog.mode}
          themeId={themeDialog.mode === 'edit' ? theme : undefined}
          onEditCss={(draft) => setThemeDialog({ kind: 'editor', mode: themeDialog.mode, draft })}
        />
      )}
      <div className={SETTING_ROW}>
        <Label id="font-size-label" className={SETTING_LABEL}>
          {t('profileSettings.fontSize')}
        </Label>
        <div className="col-span-full flex gap-2 sm:col-span-3" role="group" aria-labelledby="font-size-label">
          {FONT_SIZES.map(({ size, label }) => (
            <Button
              key={size}
              type="button"
              variant={fontSize === size ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFontSize(size)}
              className={cn('flex-1', fontSize === size && 'pointer-events-none')}
              data-testid={`font-size-${size}`}
              aria-pressed={fontSize === size}
            >
              {t(label)}
            </Button>
          ))}
        </div>
      </div>
      <div className={SETTING_ROW}>
        <Label className={SETTING_LABEL}>
          {t('profileSettings.language')}
        </Label>
        <div className="col-span-full sm:col-span-3">
          <Select
            value={language}
            onValueChange={(value: LanguageSetting) => {
              setLanguage(value);
              i18n.changeLanguage(value === 'auto' ? navigator.language : value);
            }}
          >
            <SelectTrigger data-testid="language-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto" data-testid="language-auto">
                {t('profileSettings.languageAuto')}
              </SelectItem>
              {languages.map(({ code, label, flag }) => (
                <SelectItem key={code} value={code} data-testid={`language-${code}`}>
                  {flag} {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="col-span-full flex items-center gap-4">
        <Switch
          id="hide-avatars"
          checked={hideAvatarsInUsersList}
          onCheckedChange={setHideAvatarsInUsersList}
          data-testid="hide-avatars-toggle"
        />
        <Label htmlFor="hide-avatars">
          {t('profileSettings.hideAvatars')}
        </Label>
      </div>
      <div className="col-span-full flex items-center gap-4">
        <Switch
          id="hide-typing"
          checked={hideTypingIndicator}
          onCheckedChange={setHideTypingIndicator}
          data-testid="hide-typing-toggle"
        />
        <Label htmlFor="hide-typing">
          {t('profileSettings.hideTyping')}
        </Label>
      </div>
    </div>
  );
};

export default AppearanceTab;
