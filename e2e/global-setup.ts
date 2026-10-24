import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ERGO_CONTAINER = 'sic-e2e-ergo';
const ERGO_IMAGE = 'ghcr.io/ergochat/ergo:stable';
export const IRC_PORT = 6667;
export const LEGACY_IRC_CONTAINER = 'sic-e2e-ngircd';
const LEGACY_IRC_IMAGE = 'docker.io/linuxserver/ngircd:version-27-r1';
/** A server without IRCv3, reached through the gateway */
export const LEGACY_IRC_PORT = 6668;
// Port 6697 is blocked by Chrome (ERR_UNSAFE_PORT); use 8097 instead
const WSS_PORT = 8097;
/** A bouncer (soju.im/bouncer-networks) whose networks are the test IRC servers */
export const SOJU_CONTAINER = 'sic-e2e-soju';
const SOJU_IMAGE = 'codeberg.org/emersion/soju:v0.11.1';
export const SOJU_WSS_PORT = 8098;
/** sojuctl's config inside the container */
export const SOJU_CONFIG = '/soju-config';
const STARTUP_TIMEOUT_MS = 15_000;
const STARTUP_POLL_MS = 300;

/** Path where the server password is stored for tests to read */
export const PASSWORD_FILE = join(tmpdir(), 'sic-e2e-password');

// The gateway specs run the gateway from source, checked out next to core unless E2E_GATEWAY_DIR says otherwise
const GATEWAY_DIR = process.env.E2E_GATEWAY_DIR ?? resolve(__dirname, '../../gateway');
/** Where the app is served for the projects that connect straight to the servers: off Vite's default 5173+, so tests never hit a running `pnpm start` */
export const APP_PORT = 5273;
export const GATEWAY_PORT = 8668;
export const GATEWAY_APP_PORT = 5274;
const GATEWAY_PID_FILE = join(tmpdir(), 'sic-e2e-gateway.pid');
const GATEWAY_LOG_FILE = join(tmpdir(), 'sic-e2e-gateway.log');

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

export const stopGateway = (): void => {
  try {
    process.kill(Number(readFileSync(GATEWAY_PID_FILE, 'utf8')), 'SIGKILL');
  } catch {
    // Not started, or already gone
  }
  rmSync(GATEWAY_PID_FILE, { force: true });
};

const startGateway = async (): Promise<void> => {
  // A gateway left over from an aborted run would hold the port and pass the readiness check
  stopGateway();

  if (!existsSync(join(GATEWAY_DIR, 'server.ts'))) {
    throw new Error(`Gateway sources not found in ${GATEWAY_DIR}; check out the gateway there or set E2E_GATEWAY_DIR`);
  }

  const log = openSync(GATEWAY_LOG_FILE, 'w');
  const gateway = spawn(process.execPath, ['--import', 'tsx', 'server.ts'], {
    cwd: GATEWAY_DIR,
    env: {
      ...process.env,
      PORT: String(GATEWAY_PORT),
      HOST: '127.0.0.1',
      ALLOWED_ORIGINS: `http://localhost:${GATEWAY_APP_PORT}`,
      // The test IRC servers are on loopback
      BLOCK_PRIVATE_HOSTS: 'false',
      // Keeps the suite off real networks, such as a test's ?server=Libera.Chat
      ALLOWED_SERVERS: `127.0.0.1:${IRC_PORT},127.0.0.1:${LEGACY_IRC_PORT}`,
      // Each test's closed page leaves its session behind, holding the nick; long enough for the resume tests only
      SESSION_LINGER: '15',
    },
    detached: true,
    stdio: ['ignore', log, log],
  });
  gateway.unref();
  writeFileSync(GATEWAY_PID_FILE, String(gateway.pid), 'utf8');

  try {
    await waitForPort(GATEWAY_PORT, '127.0.0.1', STARTUP_TIMEOUT_MS);
  } catch {
    console.error('Gateway log:', readFileSync(GATEWAY_LOG_FILE, 'utf8'));
    throw new Error('Gateway failed to start');
  }
};

const startLegacyIrcServer = async (serverPassword: string): Promise<void> => {
  const template = readFileSync(join(__dirname, 'ngircd', 'ngircd.conf'), 'utf8');
  const configPath = join(tmpdir(), 'sic-e2e-config', 'ngircd.conf');
  writeFileSync(configPath, template.replace(/^\[Global\]$/m, `[Global]\n\tPassword = ${serverPassword}`), 'utf8');

  try {
    execSync(`docker rm -f ${LEGACY_IRC_CONTAINER} 2>/dev/null`);
  } catch {
    // Container didn't exist
  }

  execSync(
    `docker run -d --name ${LEGACY_IRC_CONTAINER} ` +
    `-p 127.0.0.1:${LEGACY_IRC_PORT}:6667 ` +
    `-v "${configPath}:/ngircd.conf:ro" ` +
    `--entrypoint /usr/sbin/ngircd ` +
    `${LEGACY_IRC_IMAGE} --nodaemon --config /ngircd.conf`,
    { stdio: 'pipe' }
  );

  try {
    await waitForPort(LEGACY_IRC_PORT, '127.0.0.1', STARTUP_TIMEOUT_MS);
  } catch {
    console.error('ngircd container logs:', execSync(`docker logs ${LEGACY_IRC_CONTAINER} 2>&1`).toString());
    throw new Error('ngircd IRC server failed to start');
  }
};

const startSoju = async (tlsDir: string): Promise<void> => {
  const configPath = join(tmpdir(), 'sic-e2e-config', 'soju');
  writeFileSync(configPath, [
    `listen wss://127.0.0.1:${SOJU_WSS_PORT}`,
    'listen unix+admin:///data/admin.sock',
    'tls /tls/cert.pem /tls/key.pem',
    // The app's page is another origin than the bouncer's WebSocket
    `http-origin localhost:${APP_PORT}`,
    'db sqlite3 /data/soju.db',
    'hostname soju.test',
  ].join('\n'), 'utf8');

  try {
    execSync(`docker rm -f ${SOJU_CONTAINER} 2>/dev/null`);
  } catch {
    // Container didn't exist
  }

  // On the host network: its networks are the test servers, published on loopback only
  execSync(
    `docker run -d --name ${SOJU_CONTAINER} --network host --tmpfs /data ` +
    `-v "${configPath}:${SOJU_CONFIG}:ro" ` +
    `-v "${tlsDir}:/tls:ro" ` +
    `${SOJU_IMAGE}`,
    { stdio: 'pipe' }
  );

  try {
    await waitForPort(SOJU_WSS_PORT, '127.0.0.1', STARTUP_TIMEOUT_MS);
  } catch {
    console.error('soju container logs:', execSync(`docker logs ${SOJU_CONTAINER} 2>&1`).toString());
    throw new Error('soju bouncer failed to start');
  }
};

const globalSetup = async (): Promise<void> => {
  // Generate a random server password for this test run
  const serverPassword = randomBytes(16).toString('hex');
  const passwordHash = bcrypt.hashSync(serverPassword, 10);
  writeFileSync(PASSWORD_FILE, serverPassword, 'utf8');

  // Create temp dir for TLS certs
  const tlsDir = join(tmpdir(), 'sic-e2e-tls');
  mkdirSync(tlsDir, { recursive: true });
  generateCerts(tlsDir);

  // Create motd file
  const motdDir = join(tmpdir(), 'sic-e2e-motd');
  mkdirSync(motdDir, { recursive: true });
  writeFileSync(join(motdDir, 'ergo.motd'), 'Welcome to E2E Test IRC Server');

  // Generate ergo config with the server password
  const configTemplate = readFileSync(join(__dirname, 'ergo', 'ircd.yaml'), 'utf8');
  const configDir = join(tmpdir(), 'sic-e2e-config');
  mkdirSync(configDir, { recursive: true });
  const configWithPassword = configTemplate.replace(
    /^server:$/m,
    `server:\n    password: "${passwordHash}"`,
  );
  const configPath = join(configDir, 'ircd.yaml');
  writeFileSync(configPath, configWithPassword, 'utf8');

  // Stop any existing container
  try {
    execSync(`docker rm -f ${ERGO_CONTAINER} 2>/dev/null`);
  } catch {
    // Container didn't exist
  }

  // Start ergo container (bind to 127.0.0.1 to prevent external access)
  execSync(
    `docker run -d --name ${ERGO_CONTAINER} ` +
    `-p 127.0.0.1:${IRC_PORT}:${IRC_PORT} ` +
    `-p 127.0.0.1:${WSS_PORT}:${WSS_PORT} ` +
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

  await startLegacyIrcServer(serverPassword);
  await startSoju(tlsDir);
  await startGateway();
};

export default globalSetup;
