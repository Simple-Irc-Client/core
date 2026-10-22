import { execSync } from 'node:child_process';
import { LEGACY_IRC_CONTAINER, SOJU_CONTAINER, stopGateway } from './global-setup';

const ERGO_CONTAINER = 'sic-e2e-ergo';

const globalTeardown = async (): Promise<void> => {
  stopGateway();
  for (const container of [ERGO_CONTAINER, LEGACY_IRC_CONTAINER, SOJU_CONTAINER]) {
    try {
      execSync(`docker rm -f ${container} 2>/dev/null`, { stdio: 'pipe' });
    } catch {
      // Container already stopped
    }
  }
};

export default globalTeardown;
