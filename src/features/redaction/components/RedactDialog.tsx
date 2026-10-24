import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@shared/components/ui/dialog';
import { getDisplayNickFromMessage } from '@shared/lib/displayName';
import { stripIrcFormatting } from '@shared/lib/ircFormatting';
import { type Message } from '@shared/types';
import { sendRedaction } from '../redaction';

interface RedactDialogProps {
  /** The message to delete; none keeps the dialog closed */
  message: Message | undefined;
  onClose: () => void;
}

/** Deleting can't be undone, so it is confirmed first */
const RedactDialog = ({ message, onClose }: RedactDialogProps) => {
  const { t } = useTranslation();

  const handleDelete = (): void => {
    if (message !== undefined) {
      sendRedaction(message);
    }
    onClose();
  };

  return (
    <Dialog open={message !== undefined} onOpenChange={(open) => { if (!open) { onClose(); } }}>
      <DialogContent className="sm:max-w-md" data-testid="redact-dialog">
        <DialogHeader>
          <DialogTitle>{t('main.chat.deleteTitle')}</DialogTitle>
          <DialogDescription>{t('main.chat.deleteDescription')}</DialogDescription>
        </DialogHeader>
        {message !== undefined && (
          <p className="line-clamp-3 break-words rounded border-l-4 border-border bg-muted px-3 py-2 text-sm">
            <span className="font-semibold">{getDisplayNickFromMessage(message)}</span> {stripIrcFormatting(message.message)}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('main.chat.deleteCancel')}
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} data-testid="redact-confirm">
            {t('main.chat.deleteConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RedactDialog;
