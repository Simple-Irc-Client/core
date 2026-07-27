/**
 * Consent gate for an incoming DCC offer.
 *
 * Accepting a DCC offer opens a socket to an address a stranger chose and, for
 * SEND, writes a file to disk — so it always goes through an explicit dialog
 * showing exactly who, where and how big. The dialog never auto-accepts and
 * closing it counts as declining.
 */
import { useTranslation } from 'react-i18next';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { Button } from '@shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/components/ui/dialog';
import { acceptDccOffer, declineDccOffer } from '../manager';
import { DccKind } from '../protocol';
import { useDccSessionsStore } from '../store/dcc';
import { formatBytes } from '../format';
import { DccDirection, DccStatus } from '../types';

const DccOfferDialog = () => {
  const { t } = useTranslation();
  const sessions = useDccSessionsStore((state) => state.sessions);

  // Only ever prompt for one offer at a time; the rest stay queued in the panel
  // so a burst of offers cannot stack dialogs over the app.
  const offer = sessions.find(
    (session) =>
      session.direction === DccDirection.incoming && session.status === DccStatus.pending,
  );

  if (offer === undefined) {
    return null;
  }

  const handleOpenChange = (open: boolean): void => {
    if (!open) {
      declineDccOffer(offer.id);
    }
  };

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dcc-offer-dialog">
        <DialogHeader>
          <DialogTitle>
            {offer.kind === DccKind.chat
              ? t('dcc.dialog.chatTitle', { nick: offer.nick })
              : t('dcc.dialog.sendTitle', { nick: offer.nick })}
          </DialogTitle>
          <DialogDescription>{t('dcc.dialog.description')}</DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t('dcc.dialog.from')}</dt>
          <dd className="font-medium">{offer.nick}</dd>

          <dt className="text-muted-foreground">{t('dcc.dialog.address')}</dt>
          <dd className="font-mono text-xs">{offer.host}:{offer.port}</dd>

          {offer.kind === DccKind.send && (
            <>
              <dt className="text-muted-foreground">{t('dcc.dialog.file')}</dt>
              <dd className="break-all">{offer.filename}</dd>
              <dt className="text-muted-foreground">{t('dcc.dialog.size')}</dt>
              <dd>{formatBytes(offer.size)}</dd>
            </>
          )}

          <dt className="text-muted-foreground">{t('dcc.dialog.security')}</dt>
          <dd className="flex items-center gap-1.5">
            {offer.secure ? (
              <>
                <ShieldCheck className="h-4 w-4 text-green-600" aria-hidden />
                {t('dcc.dialog.secure')}
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden />
                {t('dcc.dialog.insecure')}
              </>
            )}
          </dd>
        </dl>

        <p className="text-xs text-muted-foreground">{t('dcc.dialog.warning')}</p>

        <DialogFooter>
          <Button variant="outline" onClick={() => declineDccOffer(offer.id)}>
            {t('dcc.dialog.decline')}
          </Button>
          <Button
            onClick={() => {
              void acceptDccOffer(offer.id);
            }}
          >
            {t('dcc.dialog.accept')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DccOfferDialog;
