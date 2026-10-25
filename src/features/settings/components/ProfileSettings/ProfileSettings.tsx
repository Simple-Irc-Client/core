import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell, Palette, Shield, User as UserIcon, type LucideIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@shared/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@shared/components/ui/tabs';
import ProfileTab from './tabs/ProfileTab';
import AppearanceTab from './tabs/AppearanceTab';
import NotificationsTab from './tabs/NotificationsTab';
import PrivacyTab from './tabs/PrivacyTab';

type ProfileSettingsTab = 'profile' | 'appearance' | 'notifications' | 'privacy';

const TAB_PANEL = 'mt-2 [grid-area:1/1] data-[state=inactive]:invisible';

const TABS: { value: ProfileSettingsTab; label: string; Icon: LucideIcon }[] = [
  { value: 'profile', label: 'profileSettings.tabs.profile', Icon: UserIcon },
  { value: 'appearance', label: 'profileSettings.tabs.appearance', Icon: Palette },
  { value: 'notifications', label: 'profileSettings.tabs.notifications', Icon: Bell },
  { value: 'privacy', label: 'profileSettings.tabs.privacy', Icon: Shield },
];

interface ProfileSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentNick: string;
}

const ProfileSettings = ({ open, onOpenChange, currentNick }: ProfileSettingsProps) => {
  const { t } = useTranslation();
  // Outlives the dialog's content, so reopening returns to the last tab
  const [activeTab, setActiveTab] = useState<ProfileSettingsTab>('profile');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        {open && (
          <>
            <DialogHeader>
              <DialogTitle>{t('profileSettings.title')}</DialogTitle>
              <DialogDescription>{t('profileSettings.description')}</DialogDescription>
            </DialogHeader>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ProfileSettingsTab)} className="min-w-0">
              <TabsList className="grid h-auto w-full grid-cols-4">
                {TABS.map(({ value, label, Icon }) => (
                  <TabsTrigger key={value} value={value} className="flex-col gap-1 px-1 text-xs sm:flex-row sm:gap-2 sm:text-sm" data-testid={`profile-tab-${value}`}>
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="max-w-full truncate">{t(label)}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
              {/* The tabs share one cell, the hidden ones still taking their space: the dialog is as tall as the tallest
                  tab, so switching never resizes it, and it scrolls only on a screen too short for that */}
              <div className="mt-2 grid max-h-[calc(100dvh-14rem)] overflow-y-auto p-1">
                <TabsContent forceMount value="profile" className={TAB_PANEL}>
                  <ProfileTab currentNick={currentNick} onDone={() => onOpenChange(false)} />
                </TabsContent>
                <TabsContent forceMount value="appearance" className={TAB_PANEL}>
                  <AppearanceTab />
                </TabsContent>
                <TabsContent forceMount value="notifications" className={TAB_PANEL}>
                  <NotificationsTab />
                </TabsContent>
                <TabsContent forceMount value="privacy" className={TAB_PANEL}>
                  <PrivacyTab />
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProfileSettings;
