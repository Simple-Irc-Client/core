import HighlightWordsSetting from '../../HighlightWordsSetting';
import NotificationSoundsSetting from '../../NotificationSoundsSetting';
import { SETTINGS_GRID } from '../../settingsLayout';

const NotificationsTab = () => (
  <div className={SETTINGS_GRID}>
    <HighlightWordsSetting />
    <NotificationSoundsSetting />
  </div>
);

export default NotificationsTab;
