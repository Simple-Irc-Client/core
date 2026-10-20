import { useEffect, useState } from 'react';
import { getAppVersion } from '@/runtime/desktop';

// Tauri app version (desktop/mobile only) plus the core git commit
const AppVersion = () => {
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getAppVersion().then((version) => {
      if (!cancelled) {
        setAppVersion(version);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div data-testid="app-version" className="px-4 pt-2 pb-safe-2 text-[8px] text-muted-foreground select-text">
      {appVersion !== null ? `v${appVersion} · ${__GIT_REF__}` : __GIT_REF__}
    </div>
  );
};

export default AppVersion;
