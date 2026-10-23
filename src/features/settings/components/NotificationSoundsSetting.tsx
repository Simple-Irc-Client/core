import { Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@features/settings/store/settings';
import { NOTIFICATION_SOUNDS, playSound, type NotificationSound } from '@features/sounds/sounds';
import { Button } from '@shared/components/ui/button';
import { Label } from '@shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@shared/components/ui/select';

const SOUND_OPTIONS: NotificationSound[] = ['off', ...NOTIFICATION_SOUNDS];

interface SoundRowProps {
  id: string;
  label: string;
  sound: NotificationSound;
  volume: number;
  onChange: (sound: NotificationSound) => void;
}

const SoundRow = ({ id, label, sound, volume, onChange }: SoundRowProps) => {
  const { t } = useTranslation();

  return (
    <div className="col-span-full grid grid-cols-subgrid items-center">
      <Label id={`${id}-label`} className="text-right">
        {label}
      </Label>
      <Select value={sound} onValueChange={(value) => onChange(value as NotificationSound)}>
        <SelectTrigger className="col-span-2" data-testid={`${id}-select`} aria-labelledby={`${id}-label`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SOUND_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {t(`profileSettings.sound.${option}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={sound === 'off'}
        onClick={() => void playSound(sound, volume)}
        aria-label={t('profileSettings.playSound', { label })}
      >
        <Play className="h-4 w-4" />
      </Button>
    </div>
  );
};

const NotificationSoundsSetting = () => {
  const { t } = useTranslation();
  const directSound = useSettingsStore((state) => state.directSound);
  const setDirectSound = useSettingsStore((state) => state.setDirectSound);
  const mentionSound = useSettingsStore((state) => state.mentionSound);
  const setMentionSound = useSettingsStore((state) => state.setMentionSound);
  const soundVolume = useSettingsStore((state) => state.soundVolume);
  const setSoundVolume = useSettingsStore((state) => state.setSoundVolume);

  return (
    <>
      <SoundRow id="direct-sound" label={t('profileSettings.directSound')} sound={directSound} volume={soundVolume} onChange={setDirectSound} />
      <SoundRow id="mention-sound" label={t('profileSettings.mentionSound')} sound={mentionSound} volume={soundVolume} onChange={setMentionSound} />
      <div className="col-span-full grid grid-cols-subgrid items-center">
        <Label htmlFor="sound-volume" className="text-right">
          {t('profileSettings.soundVolume')}
        </Label>
        <input
          id="sound-volume"
          type="range"
          min={0}
          max={100}
          step={5}
          value={soundVolume}
          onChange={(e) => setSoundVolume(Number(e.target.value))}
          className="col-span-2 accent-primary"
        />
        <span className="text-sm text-muted-foreground tabular-nums">{soundVolume}%</span>
      </div>
    </>
  );
};

export default NotificationSoundsSetting;
