/**
 * DCC preferences.
 *
 * Deliberately its own dialog rather than a section of Profile Settings: these
 * are security-relevant toggles (who may reach us, what we accept, where files
 * land) and they belong next to the transfers they govern.
 */
import { useTranslation } from 'react-i18next';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Switch } from '@shared/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@shared/components/ui/dialog';
import { DEFAULT_MAX_FILE_SIZE } from '../protocol';
import { useDccSettingsStore } from '../store/dcc';
import { isDccAvailable, pickDownloadDirectory } from '../transport';

interface DccSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MiB = 1024 * 1024;

const DccSettingsDialog = ({ open, onOpenChange }: DccSettingsDialogProps) => {
  const { t } = useTranslation();
  const settings = useDccSettingsStore((state) => state.settings);
  const setDccSettings = useDccSettingsStore((state) => state.setDccSettings);

  const handlePickDirectory = async (): Promise<void> => {
    try {
      const directory = await pickDownloadDirectory();
      if (directory !== null) {
        setDccSettings({ downloadDirectory: directory });
      }
    } catch {
      // The picker is desktop-only; on web the whole panel is already disabled.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dcc-settings-dialog">
        <DialogHeader>
          <DialogTitle>{t('dcc.settings.title')}</DialogTitle>
          <DialogDescription>{t('dcc.settings.description')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="dcc-enabled">{t('dcc.settings.enabled')}</Label>
            <Switch
              id="dcc-enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) => setDccSettings({ enabled: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="pr-4">
              <Label htmlFor="dcc-secure-only">{t('dcc.settings.secureOnly')}</Label>
              <p className="text-xs text-muted-foreground">{t('dcc.settings.secureOnlyHint')}</p>
            </div>
            <Switch
              id="dcc-secure-only"
              checked={settings.secureOnly}
              onCheckedChange={(checked) => setDccSettings({ secureOnly: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="pr-4">
              <Label htmlFor="dcc-private">{t('dcc.settings.allowPrivate')}</Label>
              <p className="text-xs text-muted-foreground">{t('dcc.settings.allowPrivateHint')}</p>
            </div>
            <Switch
              id="dcc-private"
              checked={settings.allowPrivateAddress}
              onCheckedChange={(checked) => setDccSettings({ allowPrivateAddress: checked })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dcc-directory">{t('dcc.settings.downloadDirectory')}</Label>
            <div className="flex gap-2">
              <Input
                id="dcc-directory"
                readOnly
                value={settings.downloadDirectory ?? t('dcc.settings.downloadDirectoryDefault')}
              />
              <Button variant="outline" onClick={() => void handlePickDirectory()} disabled={!isDccAvailable()}>
                {t('dcc.settings.browse')}
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dcc-max-size">{t('dcc.settings.maxFileSize')}</Label>
            <Input
              id="dcc-max-size"
              type="number"
              min={1}
              value={Math.round(settings.maxFileSize / MiB)}
              onChange={(e) => {
                const megabytes = Number(e.target.value);
                setDccSettings({
                  maxFileSize:
                    Number.isFinite(megabytes) && megabytes > 0
                      ? megabytes * MiB
                      : DEFAULT_MAX_FILE_SIZE,
                });
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dcc-advertised">{t('dcc.settings.advertisedHost')}</Label>
            <Input
              id="dcc-advertised"
              placeholder={t('dcc.settings.advertisedHostPlaceholder')}
              value={settings.advertisedHost ?? ''}
              onChange={(e) =>
                setDccSettings({ advertisedHost: e.target.value.trim() === '' ? null : e.target.value.trim() })
              }
            />
            <p className="text-xs text-muted-foreground">{t('dcc.settings.advertisedHostHint')}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>{t('dcc.settings.portRange')}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={65535}
                aria-label={t('dcc.settings.portRangeStart')}
                value={settings.portRangeStart}
                onChange={(e) => setDccSettings({ portRangeStart: Number(e.target.value) || 0 })}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="number"
                min={0}
                max={65535}
                aria-label={t('dcc.settings.portRangeEnd')}
                value={settings.portRangeEnd}
                onChange={(e) => setDccSettings({ portRangeEnd: Number(e.target.value) || 0 })}
              />
            </div>
            <p className="text-xs text-muted-foreground">{t('dcc.settings.portRangeHint')}</p>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t('dcc.settings.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DccSettingsDialog;
