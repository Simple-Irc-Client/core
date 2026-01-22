import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ircSendRawMessage } from '@/network/irc/network';
import { useSettingsStore } from '@features/settings/store/settings';
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

interface ProfileSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentNick: string;
}

interface ProfileSettingsContentProps {
  onOpenChange: (open: boolean) => void;
  currentNick: string;
}

const ProfileSettingsContent = ({ onOpenChange, currentNick }: ProfileSettingsContentProps) => {
  const { t } = useTranslation();
  const [newNick, setNewNick] = useState(currentNick);
  const supportedOptions = useSettingsStore((state) => state.supportedOptions);
  const currentUserAvatar = useSettingsStore((state) => state.currentUserAvatar);
  const [newAvatar, setNewAvatar] = useState(currentUserAvatar ?? '');

  const isAvatarSupported = supportedOptions.includes('metadata-avatar');

  const handleNickChange = (): void => {
    if (newNick.trim().length > 0) {
      ircSendRawMessage(`NICK ${newNick.trim()}`);
      onOpenChange(false);
    }
  };

  const handleAvatarChange = (): void => {
    const trimmedAvatar = newAvatar.trim();
    if (trimmedAvatar.length > 0) {
      ircSendRawMessage(`METADATA * SET avatar ${trimmedAvatar}`);
    } else {
      ircSendRawMessage('METADATA * SET avatar');
    }
    onOpenChange(false);
  };

  return (
    <>
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
        {isAvatarSupported && (
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="avatar" className="text-right">
              {t('main.toolbar.avatar')}
            </Label>
            <Input
              id="avatar"
              value={newAvatar}
              onChange={(e) => setNewAvatar(e.target.value)}
              className="col-span-3"
              placeholder="https://example.com/avatar.png"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAvatarChange();
                }
              }}
            />
          </div>
        )}
      </div>
      <DialogFooter>
        {isAvatarSupported && (
          <Button type="button" variant="outline" onClick={handleAvatarChange}>
            {t('main.toolbar.changeAvatar')}
          </Button>
        )}
        <Button type="button" onClick={handleNickChange}>
          {t('main.toolbar.changeNick')}
        </Button>
      </DialogFooter>
    </>
  );
};

const ProfileSettings = ({ open, onOpenChange, currentNick }: ProfileSettingsProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {open && (
          <ProfileSettingsContent
            onOpenChange={onOpenChange}
            currentNick={currentNick}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProfileSettings;
