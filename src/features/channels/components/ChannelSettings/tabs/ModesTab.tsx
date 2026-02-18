import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useChannelSettingsStore } from '@features/channels/store/channelSettings';
import { useSettingsStore } from '@features/settings/store/settings';
import { ircSendRawMessage } from '@/network/irc/network';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Switch } from '@shared/components/ui/switch';
import { Loader2 } from 'lucide-react';

interface ModesTabProps {
  channelName: string;
}

// Common channel mode flags (Type D - no parameters)
const COMMON_FLAGS = [
  { flag: 'n', labelKey: 'channelSettings.modes.noExternalMessages' },
  { flag: 't', labelKey: 'channelSettings.modes.topicLock' },
  { flag: 'i', labelKey: 'channelSettings.modes.inviteOnly' },
  { flag: 'm', labelKey: 'channelSettings.modes.moderated' },
  { flag: 's', labelKey: 'channelSettings.modes.secret' },
  { flag: 'p', labelKey: 'channelSettings.modes.private' },
];

const ModesTab = ({ channelName }: ModesTabProps) => {
  const { t } = useTranslation();
  const isLoading = useChannelSettingsStore((state) => state.isLoading);
  const channelModes = useChannelSettingsStore((state) => state.channelModes);
  const serverChannelModes = useSettingsStore((state) => state.channelModes);
  const supportedOptions = useSettingsStore((state) => state.supportedOptions);

  const [limit, setLimit] = useState('');
  const [key, setKey] = useState('');
  const [rawModes, setRawModes] = useState('');
  const [avatar, setAvatar] = useState('');
  const [displayName, setDisplayName] = useState('');

  const isAvatarSupported = supportedOptions?.includes('metadata-avatar') ?? false;
  const isDisplayNameSupported = supportedOptions?.includes('metadata-display-name') ?? false;

  // Derive initial values from channelModes
  const initialLimit = useMemo(() => (channelModes.l !== undefined ? String(channelModes.l) : ''), [channelModes.l]);
  const initialKey = useMemo(() => (channelModes.k !== undefined ? String(channelModes.k) : ''), [channelModes.k]);
  const initialRawModes = useMemo(() => {
    const flags = Object.entries(channelModes)
      .filter(([, value]) => value === true)
      .map(([k]) => k)
      .join('');
    return flags ? `+${flags}` : '';
  }, [channelModes]);

  // Use derived values when local state is empty (not being edited)
  const displayLimit = limit || initialLimit;
  const displayKey = key || initialKey;
  const displayRawModes = rawModes || initialRawModes;

  const handleFlagToggle = (flag: string, enabled: boolean) => {
    const mode = enabled ? `+${flag}` : `-${flag}`;
    ircSendRawMessage(`MODE ${channelName} ${mode}`);
  };

  const handleSetLimit = () => {
    if (limit.trim()) {
      ircSendRawMessage(`MODE ${channelName} +l ${limit.trim()}`);
    }
  };

  const handleClearLimit = () => {
    ircSendRawMessage(`MODE ${channelName} -l`);
    setLimit('');
  };

  const handleSetKey = () => {
    if (key.trim()) {
      ircSendRawMessage(`MODE ${channelName} +k ${key.trim()}`);
    }
  };

  const handleClearKey = () => {
    ircSendRawMessage(`MODE ${channelName} -k *`);
    setKey('');
  };

  const handleSetAvatar = () => {
    const trimmedAvatar = avatar.trim();
    if (trimmedAvatar.length > 0) {
      ircSendRawMessage(`METADATA ${channelName} SET avatar ${trimmedAvatar}`);
    }
  };

  const handleClearAvatar = () => {
    ircSendRawMessage(`METADATA ${channelName} SET avatar`);
    setAvatar('');
  };

  const handleSetDisplayName = () => {
    const trimmedDisplayName = displayName.trim();
    if (trimmedDisplayName.length > 0) {
      ircSendRawMessage(`METADATA ${channelName} SET display-name :${trimmedDisplayName}`);
    }
  };

  const handleClearDisplayName = () => {
    ircSendRawMessage(`METADATA ${channelName} SET display-name`);
    setDisplayName('');
  };

  const handleApplyRawModes = () => {
    if (rawModes.trim()) {
      ircSendRawMessage(`MODE ${channelName} ${rawModes.trim()}`);
    }
  };

  // Get available Type D flags from server config
  const availableFlags = serverChannelModes.D || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8" role="status">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        <span className="ml-2">{t('channelSettings.loading')}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {/* Channel Flags Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">{t('channelSettings.modes.flags')}</h3>
        <div className="grid grid-cols-2 gap-4">
          {COMMON_FLAGS.filter((mode) => availableFlags.includes(mode.flag)).map((mode) => (
            <div key={mode.flag} className="flex items-center space-x-2">
              <Switch
                id={`mode-${mode.flag}`}
                checked={channelModes[mode.flag] === true}
                onCheckedChange={(checked) => handleFlagToggle(mode.flag, checked)}
                data-testid={`mode-switch-${mode.flag}`}
              />
              <Label htmlFor={`mode-${mode.flag}`} className="text-sm">
                {t(mode.labelKey)} (+{mode.flag})
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Channel Settings Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">{t('channelSettings.modes.settings')}</h3>

        {/* User Limit */}
        {availableFlags.includes('l') || serverChannelModes.C?.includes('l') ? (
          <div className="flex items-center gap-2">
            <Label htmlFor="limit" className="w-24 shrink-0">
              {t('channelSettings.modes.userLimit')}
            </Label>
            <Input
              id="limit"
              type="number"
              value={displayLimit}
              onChange={(e) => setLimit(e.target.value)}
              className="w-24"
              placeholder="0"
              onKeyDown={(e) => e.key === 'Enter' && handleSetLimit()}
              data-testid="limit-input"
            />
            <Button type="button" size="sm" onClick={handleSetLimit} data-testid="limit-set">
              {t('channelSettings.actions.set')}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleClearLimit} data-testid="limit-clear">
              {t('channelSettings.actions.clear')}
            </Button>
          </div>
        ) : null}

        {/* Channel Key */}
        {serverChannelModes.B?.includes('k') ? (
          <div className="flex items-center gap-2">
            <Label htmlFor="key" className="w-24 shrink-0">
              {t('channelSettings.modes.channelKey')}
            </Label>
            <Input
              id="key"
              type="text"
              value={displayKey}
              onChange={(e) => setKey(e.target.value)}
              className="flex-1"
              placeholder="********"
              onKeyDown={(e) => e.key === 'Enter' && handleSetKey()}
              data-testid="key-input"
            />
            <Button type="button" size="sm" onClick={handleSetKey} data-testid="key-set">
              {t('channelSettings.actions.set')}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleClearKey} data-testid="key-clear">
              {t('channelSettings.actions.clear')}
            </Button>
          </div>
        ) : null}

        {/* Channel Avatar (IRCv3 metadata) */}
        {isAvatarSupported ? (
          <div className="flex items-center gap-2">
            <Label htmlFor="avatar" className="w-24 shrink-0">
              {t('channelSettings.modes.avatar')}
            </Label>
            <Input
              id="avatar"
              type="text"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              className="flex-1"
              placeholder="https://example.com/avatar.png"
              onKeyDown={(e) => e.key === 'Enter' && handleSetAvatar()}
              data-testid="avatar-input"
            />
            <Button type="button" size="sm" onClick={handleSetAvatar} data-testid="avatar-set">
              {t('channelSettings.actions.set')}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleClearAvatar} data-testid="avatar-clear">
              {t('channelSettings.actions.clear')}
            </Button>
          </div>
        ) : null}

        {/* Channel Display Name (IRCv3 metadata) */}
        {isDisplayNameSupported ? (
          <div className="flex items-center gap-2">
            <Label htmlFor="displayName" className="w-24 shrink-0">
              {t('channelSettings.modes.displayName')}
            </Label>
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="flex-1"
              placeholder={t('channelSettings.modes.displayNamePlaceholder')}
              onKeyDown={(e) => e.key === 'Enter' && handleSetDisplayName()}
              data-testid="displayName-input"
            />
            <Button type="button" size="sm" onClick={handleSetDisplayName} data-testid="displayName-set">
              {t('channelSettings.actions.set')}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={handleClearDisplayName} data-testid="displayName-clear">
              {t('channelSettings.actions.clear')}
            </Button>
          </div>
        ) : null}
      </div>

      {/* Raw Modes Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">{t('channelSettings.modes.rawModes')}</h3>
        <p className="text-xs text-muted-foreground">{t('channelSettings.modes.rawModesDescription')}</p>
        <div className="flex items-center gap-2">
          <Input
            id="raw-modes"
            type="text"
            value={displayRawModes}
            onChange={(e) => setRawModes(e.target.value)}
            className="flex-1"
            placeholder="+ntis-mp"
            aria-label={t('channelSettings.modes.rawModesLabel')}
            onKeyDown={(e) => e.key === 'Enter' && handleApplyRawModes()}
            data-testid="raw-modes-input"
          />
          <Button type="button" size="sm" onClick={handleApplyRawModes} data-testid="raw-modes-apply">
            {t('channelSettings.actions.apply')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ModesTab;
