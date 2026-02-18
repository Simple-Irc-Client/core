import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/app/i18n';
import { languages } from '@/config/languages';
import { ircSendRawMessage } from '@/network/irc/network';
import { useSettingsStore } from '@features/settings/store/settings';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@shared/components/ui/dialog';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';
import { Switch } from '@shared/components/ui/switch';
import { cn, isSafeUrl } from '@shared/lib/utils';

type LanguageSetting = 'auto' | (typeof languages)[number]['code'];

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
  const currentUserDisplayName = useSettingsStore((state) => state.currentUserDisplayName);
  const currentUserStatus = useSettingsStore((state) => state.currentUserStatus);
  const currentUserHomepage = useSettingsStore((state) => state.currentUserHomepage);
  const currentUserColor = useSettingsStore((state) => state.currentUserColor);
  const theme = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const hideAvatarsInUsersList = useSettingsStore((state) => state.hideAvatarsInUsersList);
  const setHideAvatarsInUsersList = useSettingsStore((state) => state.setHideAvatarsInUsersList);
  const hideTypingIndicator = useSettingsStore((state) => state.hideTypingIndicator);
  const setHideTypingIndicator = useSettingsStore((state) => state.setHideTypingIndicator);
  const fontSize = useSettingsStore((state) => state.fontSize);
  const setFontSize = useSettingsStore((state) => state.setFontSize);
  const language = useSettingsStore((state) => state.language);
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const [newAvatar, setNewAvatar] = useState(currentUserAvatar ?? '');
  const [newDisplayName, setNewDisplayName] = useState(currentUserDisplayName ?? '');
  const [newStatus, setNewStatus] = useState(currentUserStatus ?? '');
  const [newHomepage, setNewHomepage] = useState(currentUserHomepage ?? '');
  const [newColor, setNewColor] = useState(currentUserColor ?? '');

  const isAvatarSupported = supportedOptions.includes('metadata-avatar');
  const isDisplayNameSupported = supportedOptions.includes('metadata-display-name');
  const isStatusSupported = supportedOptions.includes('metadata-status');
  const isHomepageSupported = supportedOptions.includes('metadata-homepage');
  const isColorSupported = supportedOptions.includes('metadata-color');

  const handleNickChange = (): void => {
    if (newNick.trim().length > 0) {
      ircSendRawMessage(`NICK ${newNick.trim()}`);
      onOpenChange(false);
    }
  };

  const handleAvatarChange = (): void => {
    const trimmedAvatar = newAvatar.trim();
    if (trimmedAvatar.length > 0) {
      if (!isSafeUrl(trimmedAvatar)) return;
      ircSendRawMessage(`METADATA * SET avatar ${trimmedAvatar}`);
    } else {
      ircSendRawMessage('METADATA * SET avatar');
    }
    onOpenChange(false);
  };

  const handleDisplayNameChange = (): void => {
    const trimmedDisplayName = newDisplayName.trim();
    if (trimmedDisplayName.length > 0) {
      ircSendRawMessage(`METADATA * SET display-name :${trimmedDisplayName}`);
    } else {
      ircSendRawMessage('METADATA * SET display-name');
    }
    onOpenChange(false);
  };

  const handleStatusChange = (): void => {
    const trimmedStatus = newStatus.trim();
    if (trimmedStatus.length > 0) {
      ircSendRawMessage(`METADATA * SET status :${trimmedStatus}`);
    } else {
      ircSendRawMessage('METADATA * SET status');
    }
    onOpenChange(false);
  };

  const handleHomepageChange = (): void => {
    const trimmedHomepage = newHomepage.trim();
    if (trimmedHomepage.length > 0) {
      if (!isSafeUrl(trimmedHomepage)) return;
      ircSendRawMessage(`METADATA * SET homepage ${trimmedHomepage}`);
    } else {
      ircSendRawMessage('METADATA * SET homepage');
    }
    onOpenChange(false);
  };

  const handleColorChange = (): void => {
    const trimmedColor = newColor.trim();
    if (trimmedColor.length > 0) {
      ircSendRawMessage(`METADATA * SET color ${trimmedColor}`);
    } else {
      ircSendRawMessage('METADATA * SET color');
    }
    onOpenChange(false);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t('profileSettings.title')}</DialogTitle>
        <DialogDescription>{t('profileSettings.description')}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="nick" className="text-right">
            {t('profileSettings.nick')}
          </Label>
          <Input
            id="nick"
            value={newNick}
            onChange={(e) => setNewNick(e.target.value)}
            className="col-span-2"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleNickChange();
              }
            }}
          />
          <Button type="button" size="sm" onClick={handleNickChange}>
            {t('profileSettings.changeNick')}
          </Button>
        </div>
        {isAvatarSupported && (
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="avatar" className="text-right">
              {t('profileSettings.avatar')}
            </Label>
            <Input
              id="avatar"
              value={newAvatar}
              onChange={(e) => setNewAvatar(e.target.value)}
              className="col-span-2"
              placeholder="https://example.com/avatar.png"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAvatarChange();
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={handleAvatarChange}>
              {t('profileSettings.changeAvatar')}
            </Button>
          </div>
        )}
        {isColorSupported && (
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="color" className="text-right">
              {t('profileSettings.nickColor')}
            </Label>
            <Input
              id="color"
              type="color"
              value={newColor || '#000000'}
              onChange={(e) => setNewColor(e.target.value)}
              className="col-span-2 h-10 cursor-pointer"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleColorChange();
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={handleColorChange}>
              {t('profileSettings.changeColor')}
            </Button>
          </div>
        )}
        {isDisplayNameSupported && (
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="displayName" className="text-right">
              {t('profileSettings.displayName')}
            </Label>
            <Input
              id="displayName"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              className="col-span-2"
              placeholder={t('profileSettings.displayNamePlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleDisplayNameChange();
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={handleDisplayNameChange}>
              {t('profileSettings.changeDisplayName')}
            </Button>
          </div>
        )}
        {isStatusSupported && (
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">
              {t('profileSettings.status')}
            </Label>
            <Input
              id="status"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="col-span-2"
              placeholder={t('profileSettings.statusPlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleStatusChange();
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={handleStatusChange}>
              {t('profileSettings.changeStatus')}
            </Button>
          </div>
        )}
        {isHomepageSupported && (
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="homepage" className="text-right">
              {t('profileSettings.homepage')}
            </Label>
            <Input
              id="homepage"
              value={newHomepage}
              onChange={(e) => setNewHomepage(e.target.value)}
              className="col-span-2"
              placeholder={t('profileSettings.homepagePlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleHomepageChange();
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={handleHomepageChange}>
              {t('profileSettings.changeHomepage')}
            </Button>
          </div>
        )}
        <div className="grid grid-cols-4 items-center gap-4">
          <Label className="text-right">
            {t('profileSettings.layout')}
          </Label>
          <div className="col-span-3 flex gap-2">
            <Button
              type="button"
              variant={theme === 'classic' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTheme('classic')}
              className={cn('flex-1', theme === 'classic' && 'pointer-events-none')}
              data-testid="layout-classic"
              aria-pressed={theme === 'classic'}
            >
              {t('profileSettings.layoutClassic')}
            </Button>
            <Button
              type="button"
              variant={theme === 'modern' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTheme('modern')}
              className={cn('flex-1', theme === 'modern' && 'pointer-events-none')}
              data-testid="layout-modern"
              aria-pressed={theme === 'modern'}
            >
              {t('profileSettings.layoutModern')}
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Switch
            id="hide-avatars"
            checked={hideAvatarsInUsersList}
            onCheckedChange={setHideAvatarsInUsersList}
            data-testid="hide-avatars-toggle"
          />
          <Label htmlFor="hide-avatars">
            {t('profileSettings.hideAvatars')}
          </Label>
        </div>
        <div className="flex items-center gap-4">
          <Switch
            id="hide-typing"
            checked={hideTypingIndicator}
            onCheckedChange={setHideTypingIndicator}
            data-testid="hide-typing-toggle"
          />
          <Label htmlFor="hide-typing">
            {t('profileSettings.hideTyping')}
          </Label>
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label className="text-right">
            {t('profileSettings.fontSize')}
          </Label>
          <div className="col-span-3 flex gap-2">
            <Button
              type="button"
              variant={fontSize === 'small' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFontSize('small')}
              className={cn('flex-1', fontSize === 'small' && 'pointer-events-none')}
              data-testid="font-size-small"
              aria-pressed={fontSize === 'small'}
            >
              {t('profileSettings.fontSizeSmall')}
            </Button>
            <Button
              type="button"
              variant={fontSize === 'medium' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFontSize('medium')}
              className={cn('flex-1', fontSize === 'medium' && 'pointer-events-none')}
              data-testid="font-size-medium"
              aria-pressed={fontSize === 'medium'}
            >
              {t('profileSettings.fontSizeMedium')}
            </Button>
            <Button
              type="button"
              variant={fontSize === 'large' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFontSize('large')}
              className={cn('flex-1', fontSize === 'large' && 'pointer-events-none')}
              data-testid="font-size-large"
              aria-pressed={fontSize === 'large'}
            >
              {t('profileSettings.fontSizeLarge')}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-4 items-center gap-4">
          <Label className="text-right">
            {t('profileSettings.language')}
          </Label>
          <div className="col-span-3">
            <Select
              value={language}
              onValueChange={(value: LanguageSetting) => {
                setLanguage(value);
                i18n.changeLanguage(value === 'auto' ? navigator.language : value);
              }}
            >
              <SelectTrigger data-testid="language-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto" data-testid="language-auto">
                  {t('profileSettings.languageAuto')}
                </SelectItem>
                {languages.map(({ code, label, flag }) => (
                  <SelectItem key={code} value={code} data-testid={`language-${code}`}>
                    {flag} {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
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
