import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useChannelSettingsStore } from '@features/channels/store/channelSettings';
import { useChannelsStore } from '@features/channels/store/channels';
import { useSettingsStore } from '@features/settings/store/settings';
import { ircSendRawMessage } from '@/network/irc/network';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Switch } from '@shared/components/ui/switch';
import { Loader2, Check, X } from 'lucide-react';

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
  const channelAvatar = useChannelsStore((state) => state.openChannels.find((ch) => ch.name === channelName)?.avatar ?? '');
  const channelDisplayName = useChannelsStore((state) => state.openChannels.find((ch) => ch.name === channelName)?.displayName ?? '');
  const [avatar, setAvatar] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [paramEdits, setParamEdits] = useState<Record<string, string>>({});

  const isAvatarSupported = supportedOptions?.includes('metadata-avatar') ?? false;
  const isDisplayNameSupported = supportedOptions?.includes('metadata-display-name') ?? false;

  // Derive initial values from channelModes
  const initialLimit = useMemo(() => (channelModes.l !== undefined ? String(channelModes.l) : ''), [channelModes.l]);
  const initialKey = useMemo(() => (channelModes.k !== undefined ? String(channelModes.k) : ''), [channelModes.k]);
  const initialRawModes = useMemo(() => {
    const flags = Object.keys(channelModes).join('');
    return flags ? `+${flags}` : '';
  }, [channelModes]);

  // Use derived values when local state is empty (not being edited)
  const displayLimit = limit || initialLimit;
  const displayKey = key || initialKey;
  const displayRawModes = rawModes || initialRawModes;
  const displayAvatar = avatar || channelAvatar;
  const displayDisplayName = displayName || channelDisplayName;

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
    const trimmed = rawModes.trim();
    if (!trimmed) { return; }

    // Parse the desired flags from the input (e.g. "+nrtBCN" -> Set{n,r,t,B,C,N})
    const desiredFlags = new Set<string>();
    let adding = true;
    for (const ch of trimmed) {
      if (ch === '+') { adding = true; continue; }
      if (ch === '-') { adding = false; continue; }
      if (adding) { desiredFlags.add(ch); }
    }

    // Get all current flags from channel modes
    const currentFlags = new Set(Object.keys(channelModes));

    // Compute flags to add and remove
    const toAdd = [...desiredFlags].filter((f) => !currentFlags.has(f)).join('');
    const toRemove = [...currentFlags].filter((f) => !desiredFlags.has(f)).join('');

    const addPart = toAdd ? '+' + toAdd : '';
    const removePart = toRemove ? '-' + toRemove : '';
    const modeString = addPart + removePart;
    if (modeString) {
      ircSendRawMessage(`MODE ${channelName} ${modeString}`);
    }
  };

  // Flags that have dedicated UI controls
  const DEDICATED_FLAGS = useMemo(() => new Set(['l', 'k']), []);

  // Parameterized modes currently set on the channel (excluding dedicated ones)
  const parameterizedModes = useMemo(() =>
    Object.entries(channelModes)
      .filter(([flag, value]) => typeof value === 'string' && !DEDICATED_FLAGS.has(flag))
      .map(([flag, value]) => ({ flag, value: value as string })),
    [channelModes, DEDICATED_FLAGS],
  );

  const handleSetParamMode = (flag: string) => {
    const value = paramEdits[flag]?.trim();
    if (value) {
      ircSendRawMessage(`MODE ${channelName} +${flag} ${value}`);
    }
  };

  const handleClearParamMode = (flag: string) => {
    ircSendRawMessage(`MODE ${channelName} -${flag}`);
    setParamEdits((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([key]) => key !== flag)),
    );
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              className="flex-1"
              placeholder="0"
              onKeyDown={(e) => e.key === 'Enter' && handleSetLimit()}
              data-testid="limit-input"
            />
            <Button type="button" size="sm" className="shrink-0" onClick={handleSetLimit} data-testid="limit-set" aria-label={t('channelSettings.actions.set')}>
              <Check className="h-4 w-4 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">{t('channelSettings.actions.set')}</span>
            </Button>
            <Button type="button" size="sm" className="shrink-0" variant="outline" onClick={handleClearLimit} data-testid="limit-clear" aria-label={t('channelSettings.actions.clear')}>
              <X className="h-4 w-4 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">{t('channelSettings.actions.clear')}</span>
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
            <Button type="button" size="sm" className="shrink-0" onClick={handleSetKey} data-testid="key-set" aria-label={t('channelSettings.actions.set')}>
              <Check className="h-4 w-4 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">{t('channelSettings.actions.set')}</span>
            </Button>
            <Button type="button" size="sm" className="shrink-0" variant="outline" onClick={handleClearKey} data-testid="key-clear" aria-label={t('channelSettings.actions.clear')}>
              <X className="h-4 w-4 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">{t('channelSettings.actions.clear')}</span>
            </Button>
          </div>
        ) : null}

        {/* Parameterized Modes */}
        {parameterizedModes.map(({ flag, value }) => (
          <div key={flag} className="flex items-center gap-2">
            <Label htmlFor={`param-mode-${flag}`} className="w-24 shrink-0">
              +{flag}
            </Label>
            <Input
              id={`param-mode-${flag}`}
              type="text"
              value={paramEdits[flag] ?? value}
              onChange={(e) => setParamEdits((prev) => ({ ...prev, [flag]: e.target.value }))}
              className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleSetParamMode(flag)}
              data-testid={`param-mode-${flag}-input`}
            />
            <Button type="button" size="sm" className="shrink-0" onClick={() => handleSetParamMode(flag)} data-testid={`param-mode-${flag}-set`} aria-label={t('channelSettings.actions.set')}>
              <Check className="h-4 w-4 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">{t('channelSettings.actions.set')}</span>
            </Button>
            <Button type="button" size="sm" className="shrink-0" variant="outline" onClick={() => handleClearParamMode(flag)} data-testid={`param-mode-${flag}-clear`} aria-label={t('channelSettings.actions.clear')}>
              <X className="h-4 w-4 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">{t('channelSettings.actions.clear')}</span>
            </Button>
          </div>
        ))}

        {/* Channel Avatar (IRCv3 metadata) */}
        {isAvatarSupported ? (
          <div className="flex items-center gap-2">
            <Label htmlFor="avatar" className="w-24 shrink-0">
              {t('channelSettings.modes.avatar')}
            </Label>
            <Input
              id="avatar"
              type="text"
              value={displayAvatar}
              onChange={(e) => setAvatar(e.target.value)}
              className="flex-1"
              placeholder="https://example.com/avatar.png"
              onKeyDown={(e) => e.key === 'Enter' && handleSetAvatar()}
              data-testid="avatar-input"
            />
            <Button type="button" size="sm" className="shrink-0" onClick={handleSetAvatar} data-testid="avatar-set" aria-label={t('channelSettings.actions.set')}>
              <Check className="h-4 w-4 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">{t('channelSettings.actions.set')}</span>
            </Button>
            <Button type="button" size="sm" className="shrink-0" variant="outline" onClick={handleClearAvatar} data-testid="avatar-clear" aria-label={t('channelSettings.actions.clear')}>
              <X className="h-4 w-4 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">{t('channelSettings.actions.clear')}</span>
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
              value={displayDisplayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="flex-1"
              placeholder={t('channelSettings.modes.displayNamePlaceholder')}
              onKeyDown={(e) => e.key === 'Enter' && handleSetDisplayName()}
              data-testid="displayName-input"
            />
            <Button type="button" size="sm" className="shrink-0" onClick={handleSetDisplayName} data-testid="displayName-set" aria-label={t('channelSettings.actions.set')}>
              <Check className="h-4 w-4 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">{t('channelSettings.actions.set')}</span>
            </Button>
            <Button type="button" size="sm" className="shrink-0" variant="outline" onClick={handleClearDisplayName} data-testid="displayName-clear" aria-label={t('channelSettings.actions.clear')}>
              <X className="h-4 w-4 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">{t('channelSettings.actions.clear')}</span>
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
