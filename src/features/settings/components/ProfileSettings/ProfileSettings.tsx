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
              {/* One height for every tab, so switching tabs never resizes the dialog */}
              <div className="mt-2 h-[min(28rem,calc(100dvh-15rem))] overflow-y-auto p-1">
                <TabsContent value="profile" className="mt-2">
                  <ProfileTab currentNick={currentNick} onDone={() => onOpenChange(false)} />
                </TabsContent>
                <TabsContent value="appearance" className="mt-2">
                  <AppearanceTab />
                </TabsContent>
                <TabsContent value="notifications" className="mt-2">
                  <NotificationsTab />
                </TabsContent>
                <TabsContent value="privacy" className="mt-2">
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
