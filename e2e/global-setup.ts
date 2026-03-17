import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ERGO_CONTAINER = 'sic-e2e-ergo';
const ERGO_IMAGE = 'ghcr.io/ergochat/ergo:stable';
const IRC_PORT = 6667;
// Port 6697 is blocked by Chrome (ERR_UNSAFE_PORT); use 8097 instead
const WSS_PORT = 8097;
const STARTUP_TIMEOUT_MS = 15_000;
const STARTUP_POLL_MS = 300;

const generateCerts = (dir: string): void => {
  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout "${dir}/key.pem" -out "${dir}/cert.pem" ` +
    `-days 1 -nodes -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null`
  );
};

const waitForPort = (port: number, host: string, timeoutMs: number): Promise<void> => {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timed out waiting for ${host}:${port}`));
        return;
      }
      const socket = new net.Socket();
      socket.setTimeout(STARTUP_POLL_MS);
      socket.once('connect', () => {
        socket.destroy();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        setTimeout(tryConnect, STARTUP_POLL_MS);
      });
      socket.once('timeout', () => {
        socket.destroy();
        setTimeout(tryConnect, STARTUP_POLL_MS);
      });
      socket.connect(port, host);
    };
    tryConnect();
  });
};

const globalSetup = async (): Promise<void> => {
  // Create temp dir for TLS certs
  const tlsDir = join(tmpdir(), 'sic-e2e-tls');
  mkdirSync(tlsDir, { recursive: true });
  generateCerts(tlsDir);

  // Create motd file
  const motdDir = join(tmpdir(), 'sic-e2e-motd');
  mkdirSync(motdDir, { recursive: true });
  writeFileSync(join(motdDir, 'ergo.motd'), 'Welcome to E2E Test IRC Server');

  // Stop any existing container
  try {
    execSync(`docker rm -f ${ERGO_CONTAINER} 2>/dev/null`);
  } catch {
    // Container didn't exist
  }

  // Get the absolute path to the ergo config
  const configPath = join(__dirname, 'ergo', 'ircd.yaml');

  // Start ergo container
  execSync(
    `docker run -d --name ${ERGO_CONTAINER} ` +
    `-p ${IRC_PORT}:${IRC_PORT} ` +
    `-p ${WSS_PORT}:${WSS_PORT} ` +
    `-v "${configPath}:/ircd/ircd.yaml:ro" ` +
    `-v "${tlsDir}:/ircd/tls:ro" ` +
    `-v "${motdDir}/ergo.motd:/ircd/ergo.motd:ro" ` +
    `--entrypoint /ircd-bin/ergo ` +
    `${ERGO_IMAGE} run --conf /ircd/ircd.yaml`,
    { stdio: 'pipe' }
  );

  // Wait for ergo to be ready
  try {
    await waitForPort(IRC_PORT, '127.0.0.1', STARTUP_TIMEOUT_MS);
  } catch {
    // Print container logs for debugging
    try {
      const logs = execSync(`docker logs ${ERGO_CONTAINER} 2>&1`).toString();
      console.error('Ergo container logs:', logs);
    } catch {
      // ignore
    }
    throw new Error('Ergo IRC server failed to start');
  }
};

export default globalSetup;
