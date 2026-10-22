import { execFileSync } from 'node:child_process';
import { SOJU_CONFIG, SOJU_CONTAINER } from './global-setup';

/** The bouncer's admin tool, run inside its container */
const sojuctl = (...args: string[]): void => {
  execFileSync('docker', ['exec', SOJU_CONTAINER, 'sojuctl', '-config', SOJU_CONFIG, ...args], { stdio: 'pipe' });
};

export const createSojuUser = (username: string, password: string): void => {
  sojuctl('user', 'create', '-username', username, '-password', password);
};

export const deleteSojuNetwork = (username: string, name: string): void => {
  sojuctl('user', 'run', username, 'network', 'delete', name);
};

/** A network on the user's bouncer account: one of the test IRC servers, on loopback */
export const createSojuNetwork = (username: string, network: { name: string; port: number; nick: string; serverPassword?: string }): void => {
  sojuctl(
    'user', 'run', username, 'network', 'create',
    '-addr', `irc+insecure://127.0.0.1:${network.port}`,
    '-name', network.name,
    '-nick', network.nick,
    ...(network.serverPassword === undefined ? [] : ['-pass', network.serverPassword]),
  );
};
