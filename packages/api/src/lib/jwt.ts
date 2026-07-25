import { SignJWT, jwtVerify } from 'jose';

// HS256, 180-day expiry, claims { sub, iat, exp } only.

export const SESSION_COOKIE = 'db_session';
const EXPIRY_SECONDS = 180 * 24 * 60 * 60;
export const RENEW_AFTER_SECONDS = 7 * 24 * 60 * 60;

export async function issueToken(userId: string, secret: Uint8Array): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + EXPIRY_SECONDS)
    .sign(secret);
}

export interface Session {
  userId: string;
  issuedAt: number; // unix seconds
}

export async function verifyToken(
  token: string,
  secret: Uint8Array,
): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || typeof payload.iat !== 'number') return null;
    return { userId: payload.sub, issuedAt: payload.iat };
  } catch {
    return null;
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

export function sessionCookie(
  token: string,
  opts: { secure: boolean; domain?: string | undefined },
): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${EXPIRY_SECONDS}`,
  ];
  if (opts.secure) parts.push('Secure');
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  return parts.join('; ');
}

export function clearSessionCookie(opts: {
  secure: boolean;
  domain?: string | undefined;
}): string {
  const parts = [`${SESSION_COOKIE}=`, 'HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0'];
  if (opts.secure) parts.push('Secure');
  if (opts.domain) parts.push(`Domain=${opts.domain}`);
  return parts.join('; ');
}
