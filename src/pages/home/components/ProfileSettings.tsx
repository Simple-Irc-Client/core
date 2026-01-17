import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ircSendRawMessage } from '../../../network/irc/network';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ProfileSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentNick: string;
}

const ProfileSettings = ({ open, onOpenChange, currentNick }: ProfileSettingsProps) => {
  const { t } = useTranslation();
  const [newNick, setNewNick] = useState('');

  useEffect(() => {
    if (open) {
      setNewNick(currentNick);
    }
  }, [open, currentNick]);

  const handleNickChange = (): void => {
    if (newNick.trim().length > 0) {
      ircSendRawMessage(`NICK ${newNick.trim()}`);
      onOpenChange(false);
      setNewNick('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('main.toolbar.profileSettings')}</DialogTitle>
          <DialogDescription>{t('main.toolbar.profileDescription')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="nick" className="text-right">
              {t('main.toolbar.nick')}
            </Label>
            <Input
              id="nick"
              value={newNick}
              onChange={(e) => setNewNick(e.target.value)}
              className="col-span-3"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleNickChange();
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={handleNickChange}>
            {t('main.toolbar.changeNick')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileSettings;
