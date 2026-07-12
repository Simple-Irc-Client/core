import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { useSettingsStore } from '@features/settings/store/settings';
import { useScriptsStore } from '../store/scripts';
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

const NEW_SCRIPT_TEMPLATE = `// Scripts run sandboxed and talk to the client through the \`sic\` API.
//
// sic.on(event, handler)   events: message, notice, join, part, quit,
//                          nick, raw, connect, disconnect
//                          message/notice handlers may call e.block()
//                          or rewrite e.text
// sic.command(name, fn)    register a /command; fn(args, channel)
// sic.say(target, text)    send a message
// sic.sendRaw(line)        send a raw IRC line
// sic.print(text, target?) print a local line (not sent to the server)
// sic.fetch(url, opts?)    HTTP request (subject to CORS), returns a Promise
// sic.nick()               your current nick
// sic.currentChannel()     the active window name

sic.command('hello', (args, channel) => {
  sic.say(channel, 'Hello from my first script!');
});
`;

interface ScriptEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'edit' | 'create';
  /** Script being edited; required in 'edit' mode. */
  scriptId?: string;
}

const ScriptEditorDialog = ({ open, onOpenChange, mode, scriptId }: ScriptEditorDialogProps) => {
  const { t } = useTranslation();
  const isDarkMode = useSettingsStore((s) => s.isDarkMode);
  const addScript = useScriptsStore((s) => s.addScript);
  const updateScript = useScriptsStore((s) => s.updateScript);

  const [name, setName] = useState(() => {
    if (mode === 'create') { return t('profileSettings.scriptNewDefaultName'); }
    if (scriptId === undefined) { return ''; }
    return useScriptsStore.getState().scripts[scriptId]?.name ?? '';
  });
  const [source, setSource] = useState(() => {
    if (mode === 'create') { return NEW_SCRIPT_TEMPLATE; }
    if (scriptId === undefined) { return ''; }
    return useScriptsStore.getState().scripts[scriptId]?.source ?? '';
  });

  const handleSave = (): void => {
    const trimmedName = name.trim();
    if (trimmedName.length === 0) { return; }
    if (mode === 'create') {
      addScript(trimmedName, source);
    } else if (scriptId !== undefined) {
      updateScript(scriptId, { name: trimmedName, source });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('profileSettings.scriptEditorCreateTitle') : t('profileSettings.scriptEditorTitle')}
          </DialogTitle>
          <DialogDescription>{t('profileSettings.scriptEditorDescription')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="script-name" className="text-right">
              {t('profileSettings.scriptName')}
            </Label>
            <Input
              id="script-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="col-span-3"
              data-testid="script-name"
            />
          </div>
          <div className="rounded-md border overflow-hidden" data-testid="script-source-editor">
            <CodeMirror
              value={source}
              onChange={setSource}
              extensions={[javascript()]}
              theme={isDarkMode ? 'dark' : 'light'}
              height="55vh"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="script-cancel">
            {t('profileSettings.scriptCancel')}
          </Button>
          <Button type="button" onClick={handleSave} data-testid="script-save">
            {t('profileSettings.scriptSave')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScriptEditorDialog;
