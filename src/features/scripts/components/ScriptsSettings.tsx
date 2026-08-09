import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useScriptsStore } from '../store/scripts';
import { Button } from '@shared/components/ui/button';
import { Switch } from '@shared/components/ui/switch';
import { Label } from '@shared/components/ui/label';
import ScriptEditorDialog from './ScriptEditorDialog';

type DialogState = { mode: 'create' } | { mode: 'edit'; scriptId: string } | null;

const ScriptsSettings = () => {
  const { t } = useTranslation();
  const scripts = useScriptsStore((s) => s.scripts);
  const runtimeErrors = useScriptsStore((s) => s.runtimeErrors);
  const setScriptEnabled = useScriptsStore((s) => s.setScriptEnabled);
  const deleteScript = useScriptsStore((s) => s.deleteScript);
  const [dialog, setDialog] = useState<DialogState>(null);

  const scriptList = Object.values(scripts)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label>{t('profileSettings.scripts')}</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setDialog({ mode: 'create' })}
          data-testid="script-new"
        >
          {t('profileSettings.scriptNew')}
        </Button>
      </div>
      {scriptList.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('profileSettings.scriptsEmpty')}</p>
      )}
      {scriptList.map((script) => {
        const error = runtimeErrors[script.id];
        return (
          <div key={script.id} className="rounded-md border p-2 grid gap-1">
            <div className="flex items-center gap-2">
              <Switch
                checked={script.enabled}
                onCheckedChange={(checked) => setScriptEnabled(script.id, checked)}
                aria-label={t('profileSettings.scriptToggle', { name: script.name })}
                data-testid="script-toggle"
              />
              <span className="flex-1 truncate text-sm">{script.name}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDialog({ mode: 'edit', scriptId: script.id })}
                data-testid="script-edit"
              >
                {t('profileSettings.scriptEdit')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => deleteScript(script.id)}
                data-testid="script-delete"
              >
                {t('profileSettings.scriptDelete')}
              </Button>
            </div>
            {error !== undefined && (
              <p role="alert" className="text-xs text-destructive" data-testid="script-error">
                {error.message}
              </p>
            )}
          </div>
        );
      })}
      {dialog !== null && (
        <ScriptEditorDialog
          open
          onOpenChange={(isOpen) => { if (!isOpen) { setDialog(null); } }}
          mode={dialog.mode}
          scriptId={dialog.mode === 'edit' ? dialog.scriptId : undefined}
        />
      )}
    </div>
  );
};

export default ScriptsSettings;
