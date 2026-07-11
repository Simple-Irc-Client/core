import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/components/ui/dialog';
import { addFriend } from '@features/friends/friends';

interface AddFriendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddFriendDialog = ({ open, onOpenChange }: AddFriendDialogProps) => {
  const { t } = useTranslation();
  const [nick, setNick] = useState('');
  const [invalid, setInvalid] = useState(false);

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      setNick('');
      setInvalid(false);
    }
    onOpenChange(nextOpen);
  };

  const handleAdd = (): void => {
    if (!addFriend(nick)) {
      setInvalid(true);
      return;
    }
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t('main.friends.addDialog.title')}</DialogTitle>
          <DialogDescription>{t('main.friends.addDialog.description')}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd();
          }}
        >
          <Input
            autoFocus
            value={nick}
            onChange={(e) => {
              setNick(e.target.value);
              setInvalid(false);
            }}
            placeholder={t('main.friends.addDialog.placeholder')}
            aria-label={t('main.friends.addDialog.placeholder')}
            aria-invalid={invalid}
          />
          {invalid && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {t('main.friends.addDialog.invalidNick')}
            </p>
          )}
          <DialogFooter className="mt-4">
            <Button type="submit" disabled={nick.trim().length === 0}>
              {t('main.friends.addDialog.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddFriendDialog;
