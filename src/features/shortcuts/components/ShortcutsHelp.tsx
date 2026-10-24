import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@shared/components/ui/dialog';
import { MOD_KEY } from '../shortcuts';

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: [MOD_KEY, 'K'], action: 'shortcuts.help.switcher' },
  { keys: [MOD_KEY, '/'], action: 'shortcuts.help.help' },
  { keys: ['Enter'], action: 'shortcuts.help.send' },
  { keys: ['Shift', 'Enter'], action: 'shortcuts.help.newLine' },
  { keys: ['Tab'], action: 'shortcuts.help.complete' },
  { keys: ['↑', '↓'], action: 'shortcuts.help.history' },
  { keys: ['Esc'], action: 'shortcuts.help.cancelReply' },
  { keys: ['||…||'], action: 'shortcuts.help.spoiler' },
  { keys: ['> …'], action: 'shortcuts.help.quote' },
];

interface ShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ShortcutsHelp = ({ open, onOpenChange }: ShortcutsHelpProps) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('shortcuts.help.title')}</DialogTitle>
          <DialogDescription>{t('shortcuts.help.description')}</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm" data-testid="shortcuts-list">
          {SHORTCUTS.map(({ keys, action }) => (
            <div key={action} className="contents">
              <dt className="flex gap-1">
                {keys.map((key) => (
                  <kbd key={key} className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {key}
                  </kbd>
                ))}
              </dt>
              <dd>{t(action)}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
};

export default ShortcutsHelp;
