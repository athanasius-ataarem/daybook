import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface Config {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  databaseUrl: string;
  jwtSecret: Uint8Array;
  cookieDomain: string | undefined;
  appOrigin: string;
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error';
}

// Minimal .env loader — merges every .env walking upward from cwd (nearest
// file wins), never overriding variables already set in the environment.
// Deliberately not a dependency.
function loadDotEnv(): void {
  for (const dir of ['.', '..', '../..']) {
    let text: string;
    try {
      text = readFileSync(resolve(process.cwd(), dir, '.env'), 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!m) continue;
      const [, key, value] = m as unknown as [string, string, string];
      if (process.env[key] === undefined) {
        process.env[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  }
}

let cached: Config | null = null;

export function loadConfig(): Config {
  if (cached) return cached;
  loadDotEnv();

  const secret = process.env.JWT_SECRET ?? '';
  const decoded = Buffer.from(secret, 'base64');
  // The app must refuse to boot with a missing or short JWT_SECRET rather
  // than defaulting.
  if (decoded.length < 32) {
    throw new Error(
      'JWT_SECRET is missing or under 32 bytes. Generate one with: openssl rand -base64 48',
    );
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');
  const appOrigin = process.env.APP_ORIGIN;
  if (!appOrigin) throw new Error('APP_ORIGIN is not set');

  const nodeEnv = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  const logLevel = (process.env.LOG_LEVEL ?? 'info') as Config['logLevel'];

  cached = {
    nodeEnv,
    port: Number(process.env.PORT ?? 4000),
    databaseUrl,
    jwtSecret: new Uint8Array(decoded),
    cookieDomain: process.env.COOKIE_DOMAIN || undefined,
    appOrigin,
    logLevel,
  };
  return cached;
}
