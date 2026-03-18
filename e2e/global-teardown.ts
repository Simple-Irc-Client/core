import { execSync } from 'node:child_process';

const ERGO_CONTAINER = 'sic-e2e-ergo';

const globalTeardown = async (): Promise<void> => {
  try {
    execSync(`docker rm -f ${ERGO_CONTAINER} 2>/dev/null`, { stdio: 'pipe' });
  } catch {
    // Container already stopped
  }
};

export default globalTeardown;
