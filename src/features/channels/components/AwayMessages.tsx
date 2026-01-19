import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/components/ui/dialog';
import { Button } from '@shared/components/ui/button';
import { useAwayMessagesStore, clearAwayMessages } from '@features/channels/store/awayMessages';
import { format } from 'date-fns';

interface AwayMessagesProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AwayMessages = ({ open, onOpenChange }: AwayMessagesProps) => {
  const { t } = useTranslation();
  const awayMessages = useAwayMessagesStore((state) => state.messages);

  const handleMarkAsRead = (): void => {
    clearAwayMessages();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('main.toolbar.awayMessages')}</DialogTitle>
          <DialogDescription>{t('main.toolbar.awayMessagesDescription')}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-4">
          {awayMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center">{t('main.toolbar.noAwayMessages')}</p>
          ) : (
            <div className="space-y-3">
              {awayMessages.map((msg) => (
                <div key={msg.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span className="font-medium">{msg.channel}</span>
                    <span>{format(new Date(msg.time), 'HH:mm dd-MMM-yyyy')}</span>
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold">{typeof msg.nick === 'string' ? msg.nick : msg.nick?.nick}:</span>{' '}
                    {msg.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleMarkAsRead}>
            {t('main.toolbar.markAsRead')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AwayMessages;
