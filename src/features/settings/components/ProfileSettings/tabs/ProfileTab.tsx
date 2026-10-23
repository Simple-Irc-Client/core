import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ircSendUserCommand } from '@/network/irc/network';
import { useSettingsStore } from '@features/settings/store/settings';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { cn, isSafeImageUrl, isSafeUrl } from '@shared/lib/utils';
import { SETTING_LABEL, SETTING_ROW, SETTINGS_GRID } from '../../settingsLayout';

type MetadataKey = 'avatar' | 'display-name' | 'status' | 'homepage' | 'color';

interface FieldRowProps {
  id: string;
  label: string;
  buttonLabel: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  type?: 'text' | 'color';
  primary?: boolean;
}

const FieldRow = ({ id, label, buttonLabel, value, onChange, onSubmit, placeholder, type = 'text', primary = false }: FieldRowProps) => (
  <div className={SETTING_ROW}>
    <Label htmlFor={id} className={SETTING_LABEL}>
      {label}
    </Label>
    <Input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn('sm:col-span-2', type === 'color' && 'h-10 cursor-pointer')}
      placeholder={placeholder}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onSubmit();
        }
      }}
    />
    <Button type="button" variant={primary ? 'default' : 'outline'} size="sm" onClick={onSubmit}>
      {buttonLabel}
    </Button>
  </div>
);

interface ProfileTabProps {
  currentNick: string;
  onDone: () => void;
}

const ProfileTab = ({ currentNick, onDone }: ProfileTabProps) => {
  const { t } = useTranslation();
  const supportedOptions = useSettingsStore((state) => state.supportedOptions);
  const currentUserAvatar = useSettingsStore((state) => state.currentUserAvatar);
  const currentUserDisplayName = useSettingsStore((state) => state.currentUserDisplayName);
  const currentUserStatus = useSettingsStore((state) => state.currentUserStatus);
  const currentUserHomepage = useSettingsStore((state) => state.currentUserHomepage);
  const currentUserColor = useSettingsStore((state) => state.currentUserColor);
  const [newNick, setNewNick] = useState(currentNick);
  const [newAvatar, setNewAvatar] = useState(currentUserAvatar ?? '');
  const [newDisplayName, setNewDisplayName] = useState(currentUserDisplayName ?? '');
  const [newStatus, setNewStatus] = useState(currentUserStatus ?? '');
  const [newHomepage, setNewHomepage] = useState(currentUserHomepage ?? '');
  const [newColor, setNewColor] = useState(currentUserColor ?? '');

  const isSupported = (key: MetadataKey): boolean => supportedOptions.includes(`metadata-${key}`);

  const handleNickChange = (): void => {
    if (newNick.trim().length > 0) {
      ircSendUserCommand(`NICK ${newNick.trim()}`);
      onDone();
    }
  };

  /** An empty value clears the key; `isSafe` rejects a value without sending anything */
  const setMetadata = (key: MetadataKey, value: string, { trailing = false, isSafe }: { trailing?: boolean; isSafe?: (value: string) => boolean } = {}): void => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      ircSendUserCommand(`METADATA * SET ${key}`);
    } else {
      if (isSafe !== undefined && !isSafe(trimmed)) {
        return;
      }
      ircSendUserCommand(`METADATA * SET ${key} ${trailing ? ':' : ''}${trimmed}`);
    }
    onDone();
  };

  return (
    <div className={SETTINGS_GRID}>
      <FieldRow
        id="nick"
        label={t('profileSettings.nick')}
        buttonLabel={t('profileSettings.changeNick')}
        value={newNick}
        onChange={setNewNick}
        onSubmit={handleNickChange}
        primary
      />
      {isSupported('avatar') && (
        <FieldRow
          id="avatar"
          label={t('profileSettings.avatar')}
          buttonLabel={t('profileSettings.changeAvatar')}
          value={newAvatar}
          onChange={setNewAvatar}
          onSubmit={() => setMetadata('avatar', newAvatar, { isSafe: isSafeImageUrl })}
          placeholder="https://example.com/avatar.png"
        />
      )}
      {isSupported('color') && (
        <FieldRow
          id="color"
          type="color"
          label={t('profileSettings.nickColor')}
          buttonLabel={t('profileSettings.changeColor')}
          value={newColor || '#000000'}
          onChange={setNewColor}
          onSubmit={() => setMetadata('color', newColor)}
        />
      )}
      {isSupported('display-name') && (
        <FieldRow
          id="displayName"
          label={t('profileSettings.displayName')}
          buttonLabel={t('profileSettings.changeDisplayName')}
          value={newDisplayName}
          onChange={setNewDisplayName}
          onSubmit={() => setMetadata('display-name', newDisplayName, { trailing: true })}
          placeholder={t('profileSettings.displayNamePlaceholder')}
        />
      )}
      {isSupported('status') && (
        <FieldRow
          id="status"
          label={t('profileSettings.status')}
          buttonLabel={t('profileSettings.changeStatus')}
          value={newStatus}
          onChange={setNewStatus}
          onSubmit={() => setMetadata('status', newStatus, { trailing: true })}
          placeholder={t('profileSettings.statusPlaceholder')}
        />
      )}
      {isSupported('homepage') && (
        <FieldRow
          id="homepage"
          label={t('profileSettings.homepage')}
          buttonLabel={t('profileSettings.changeHomepage')}
          value={newHomepage}
          onChange={setNewHomepage}
          onSubmit={() => setMetadata('homepage', newHomepage, { isSafe: isSafeUrl })}
          placeholder={t('profileSettings.homepagePlaceholder')}
        />
      )}
    </div>
  );
};

export default ProfileTab;
