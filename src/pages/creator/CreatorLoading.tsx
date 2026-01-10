import { useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { useTranslation } from 'react-i18next';
import { getIsPasswordRequired, setCreatorStep, useSettingsStore, setCreatorProgress } from '../../store/settings';

const CreatorLoading = () => {
  const { t } = useTranslation();

  const isConnecting = useSettingsStore((state) => state.isConnecting);
  const isConnected = useSettingsStore((state) => state.isConnected);
  const creatorProgress = useSettingsStore((state) => state.creatorProgress);

  useEffect(() => {
    if (isConnecting) {
      setCreatorProgress(1, t('creator.loading.connecting'));
    }

    if (isConnected) {
      setCreatorProgress(2, t('creator.loading.connected'));

      const timeout2 = setTimeout(() => {
        setCreatorProgress(3, t('creator.loading.isPasswordRequired'));
      }, 2_000); // 2 sec

      const timeout5 = setTimeout(() => {
        const isPasswordRequired = getIsPasswordRequired();
        if (isPasswordRequired === false || isPasswordRequired === undefined) {
          setCreatorStep('channels');
        }
      }, 5_000); // 5 sec

      return () => {
        clearTimeout(timeout2);
        clearTimeout(timeout5);
      };
    }

    if (!isConnecting && !isConnected && creatorProgress.value !== 0) {
      setCreatorProgress(0, t('creator.loading.disconnected'));
    }
  }, [isConnecting, isConnected]);

  return (
    <div className="w-full mt-8">
      <Progress value={creatorProgress.value * 30} />
      {creatorProgress.label !== '' && <h2 className="text-center mt-4">{creatorProgress.label}</h2>}
    </div>
  );
};

export default CreatorLoading;
