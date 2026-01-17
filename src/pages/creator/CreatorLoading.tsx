import { useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { getIsPasswordRequired, setCreatorStep, useSettingsStore, setCreatorProgress, getCreatorProgress, resetAndGoToStart } from '../../store/settings';

const CreatorLoading = () => {
  const { t } = useTranslation();

  const isConnecting = useSettingsStore((state) => state.isConnecting);
  const isConnected = useSettingsStore((state) => state.isConnected);
  const creatorProgress = useSettingsStore((state) => state.creatorProgress);

  useEffect(() => {
    if (isConnecting) {
      setCreatorProgress(1, t('creator.loading.connecting'));
      return undefined;
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

    // Read current value via getter to avoid dependency
    if (!isConnecting && !isConnected && getCreatorProgress().value !== 0) {
      setCreatorProgress(0, t('creator.loading.disconnected'));
    }
    return undefined;
  }, [isConnecting, isConnected, t]);

  const handleGoBack = (): void => {
    resetAndGoToStart();
  };

  return (
    <div className="w-full mt-8">
      <Progress value={creatorProgress.value * 30} />
      {creatorProgress.label !== '' && <h2 className="text-center mt-4">{creatorProgress.label}</h2>}
      {creatorProgress.value === 0 && (
        <Button onClick={handleGoBack} variant="outline" className="w-full mt-8">
          {t('creator.loading.button.goBack')}
        </Button>
      )}
    </div>
  );
};

export default CreatorLoading;
