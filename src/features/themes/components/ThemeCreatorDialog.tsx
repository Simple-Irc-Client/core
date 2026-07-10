import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@features/settings/store/settings';
import { BUILTIN_THEMES, isBuiltinTheme, type BuiltinThemeId } from '../builtinThemes';
import { resolveThemeCss } from '../themeSelectors';
import {
  MSG_COLOR_KEYS,
  defaultCreatorSettings,
  generateThemeCss,
  parseCreatorSettings,
  type MsgColorKey,
  type ThemeCreatorSettings,
} from '../creator';
import { useThemePreview } from './useThemePreview';
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
import { Switch } from '@shared/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs';
import { cn } from '@shared/lib/utils';

interface ThemeCreatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'edit' | 'create';
  /** Theme being edited; required in 'edit' mode. */
  themeId?: string;
  /**
   * Switch to the CSS editor. Receives the unsaved Creator draft when the
   * controls were changed, or undefined when pristine (the editor then shows
   * the theme's stored CSS).
   */
  onEditCss: (draft?: { name: string; css: string }) => void;
}

const colorLabelKeys: Record<MsgColorKey, string> = {
  time: 'profileSettings.themeCreatorColorTime',
  default: 'profileSettings.themeCreatorColorDefault',
  body: 'profileSettings.themeCreatorColorBody',
  join: 'profileSettings.themeCreatorColorJoin',
  part: 'profileSettings.themeCreatorColorPart',
  quit: 'profileSettings.themeCreatorColorQuit',
  kick: 'profileSettings.themeCreatorColorKick',
  mode: 'profileSettings.themeCreatorColorMode',
  notice: 'profileSettings.themeCreatorColorNotice',
  info: 'profileSettings.themeCreatorColorInfo',
  me: 'profileSettings.themeCreatorColorMe',
  error: 'profileSettings.themeCreatorColorError',
};

/**
 * No-CSS-required theme editing: structured controls (base layout, toggles,
 * message colors for light and dark mode) that generate the theme's CSS via
 * generateThemeCss. Settings round-trip through a marker comment in the CSS,
 * so Creator-made themes re-open with their controls restored.
 */
const ThemeCreatorDialog = ({ open, onOpenChange, mode, themeId, onEditCss }: ThemeCreatorDialogProps) => {
  const { t } = useTranslation();
  const activeTheme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const addCustomTheme = useSettingsStore((s) => s.addCustomTheme);
  const updateCustomTheme = useSettingsStore((s) => s.updateCustomTheme);
  const setBuiltinThemeCss = useSettingsStore((s) => s.setBuiltinThemeCss);

  const isBuiltin = mode === 'edit' && themeId !== undefined && isBuiltinTheme(themeId);

  const [name, setName] = useState(() => {
    if (mode === 'create') { return t('profileSettings.themeNewDefaultName'); }
    if (themeId === undefined) { return ''; }
    if (isBuiltinTheme(themeId)) { return t(BUILTIN_THEMES[themeId].nameKey); }
    return useSettingsStore.getState().customThemes[themeId]?.name ?? '';
  });

  // Restore Creator settings from the theme's CSS marker; hand-written CSS
  // (or a builtin's shipped CSS) starts from defaults on the matching base
  const [initialSettings, wasHandEdited] = useMemo((): [ThemeCreatorSettings, boolean] => {
    const state = useSettingsStore.getState();
    const sourceId = mode === 'create' ? state.theme : (themeId ?? state.theme);
    const css = resolveThemeCss(state, sourceId);
    const parsed = parseCreatorSettings(css);
    if (parsed) { return [parsed, false]; }
    const base: BuiltinThemeId = isBuiltinTheme(sourceId) ? sourceId : 'modern';
    // A builtin's shipped CSS is not "hand-edited" — only warn when replacing
    // CSS someone actually wrote (an override or a custom theme)
    const isShippedDefault = isBuiltinTheme(sourceId) && css === BUILTIN_THEMES[sourceId].css;
    return [defaultCreatorSettings(base), mode === 'edit' && !isShippedDefault];
  }, [mode, themeId]);

  const [settings, setSettings] = useState<ThemeCreatorSettings>(initialSettings);

  const generatedCss = useMemo(() => generateThemeCss(settings), [settings]);

  useThemePreview(generatedCss, mode === 'create' || themeId === activeTheme);

  const patch = (changes: Partial<ThemeCreatorSettings>): void => {
    setSettings((current) => ({ ...current, ...changes }));
  };

  const patchColor = (paletteName: 'light' | 'dark', key: MsgColorKey, value: string): void => {
    setSettings((current) => ({
      ...current,
      colors: {
        ...current.colors,
        [paletteName]: { ...current.colors[paletteName], [key]: value },
      },
    }));
  };

  const handleEditCss = (): void => {
    // Carry the draft only when the user changed something here — a pristine
    // Creator must not clobber hand-written CSS with generated defaults
    const isDirty = settings !== initialSettings;
    onEditCss(isDirty ? { name, css: generatedCss } : undefined);
  };

  const handleSave = (): void => {
    const trimmedName = name.trim();
    if (mode === 'create') {
      if (trimmedName.length === 0) { return; }
      const id = addCustomTheme(trimmedName, generatedCss);
      setTheme(id);
    } else if (themeId !== undefined) {
      if (isBuiltinTheme(themeId)) {
        setBuiltinThemeCss(themeId, generatedCss);
      } else {
        if (trimmedName.length === 0) { return; }
        updateCustomTheme(themeId, { name: trimmedName, css: generatedCss });
      }
    }
    onOpenChange(false);
  };

  const renderPalette = (paletteName: 'light' | 'dark') => (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
      {MSG_COLOR_KEYS.map((key) => (
        <div key={key} className="flex items-center justify-between gap-2">
          <Label htmlFor={`creator-color-${paletteName}-${key}`} className="text-sm font-normal">
            {t(colorLabelKeys[key])}
          </Label>
          <Input
            id={`creator-color-${paletteName}-${key}`}
            type="color"
            value={settings.colors[paletteName][key]}
            onChange={(e) => patchColor(paletteName, key, e.target.value)}
            className="h-8 w-14 shrink-0 cursor-pointer p-1"
            data-testid={`creator-color-${paletteName}-${key}`}
          />
        </div>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('profileSettings.themeCreatorTitle')}</DialogTitle>
          <DialogDescription>{t('profileSettings.themeCreatorDescription')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="creator-theme-name" className="text-right">
              {t('profileSettings.themeName')}
            </Label>
            <Input
              id="creator-theme-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              disabled={isBuiltin}
              data-testid="creator-theme-name"
            />
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label id="creator-base-label" className="text-right">
              {t('profileSettings.themeCreatorLayout')}
            </Label>
            <div className="col-span-3 flex gap-2" role="group" aria-labelledby="creator-base-label">
              {(['classic', 'modern'] as const).map((base) => (
                <Button
                  key={base}
                  type="button"
                  variant={settings.base === base ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => patch({ base })}
                  className={cn('flex-1', settings.base === base && 'pointer-events-none')}
                  data-testid={`creator-base-${base}`}
                  aria-pressed={settings.base === base}
                >
                  {t(BUILTIN_THEMES[base].nameKey)}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="flex items-center gap-3">
              <Switch
                id="creator-show-seconds"
                checked={settings.showSeconds}
                onCheckedChange={(checked) => patch({ showSeconds: checked })}
                data-testid="creator-show-seconds"
              />
              <Label htmlFor="creator-show-seconds" className="font-normal">
                {t('profileSettings.themeCreatorShowSeconds')}
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="creator-show-avatars"
                checked={settings.showAvatars}
                onCheckedChange={(checked) => patch({ showAvatars: checked })}
                disabled={settings.base === 'classic'}
                data-testid="creator-show-avatars"
              />
              <Label htmlFor="creator-show-avatars" className="font-normal">
                {t('profileSettings.themeCreatorShowAvatars')}
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="creator-show-embeds"
                checked={settings.showEmbeds}
                onCheckedChange={(checked) => patch({ showEmbeds: checked })}
                data-testid="creator-show-embeds"
              />
              <Label htmlFor="creator-show-embeds" className="font-normal">
                {t('profileSettings.themeCreatorShowEmbeds')}
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="creator-compact"
                checked={settings.compact}
                onCheckedChange={(checked) => patch({ compact: checked })}
                data-testid="creator-compact"
              />
              <Label htmlFor="creator-compact" className="font-normal">
                {t('profileSettings.themeCreatorCompact')}
              </Label>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">{t('profileSettings.themeCreatorColors')}</Label>
            <Tabs defaultValue="light">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="light" data-testid="creator-tab-light">
                  {t('profileSettings.themeCreatorLight')}
                </TabsTrigger>
                <TabsTrigger value="dark" data-testid="creator-tab-dark">
                  {t('profileSettings.themeCreatorDark')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="light" className="mt-3">
                {renderPalette('light')}
              </TabsContent>
              <TabsContent value="dark" className="mt-3">
                {renderPalette('dark')}
              </TabsContent>
            </Tabs>
          </div>

          {wasHandEdited && (
            <p className="text-sm text-muted-foreground" data-testid="creator-overwrite-warning">
              {t('profileSettings.themeCreatorOverwriteWarning')}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="sm:mr-auto" onClick={handleEditCss} data-testid="creator-edit-css">
            {t('profileSettings.themeEditCss')}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="creator-cancel">
            {t('profileSettings.themeCancel')}
          </Button>
          <Button type="button" onClick={handleSave} data-testid="creator-save">
            {t('profileSettings.themeSave')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ThemeCreatorDialog;
