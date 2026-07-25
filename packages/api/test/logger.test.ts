import { describe, expect, it } from 'vitest';
import { createLogger, redact } from '../src/lib/logger';

describe('logger redaction', () => {
  it('a payload containing pin never appears in output', () => {
    const lines: string[] = [];
    const logger = createLogger('trace', (l) => lines.push(l));
    logger.info('register attempt', {
      body: { phone: '+233241234567', pin: '4726', shopName: 'Mawuli Pharmacy' },
      headers: { cookie: 'db_session=secret-token', 'Set-Cookie': 'x' },
      user: { pinHash: '$argon2id$...' },
    });
    const out = lines.join('\n');
    expect(out).not.toContain('4726');
    expect(out).not.toContain('secret-token');
    expect(out).not.toContain('$argon2id$');
    expect(out).toContain('[redacted]');
    expect(out).toContain('+233241234567');
  });

  it('redacts nested keys case-insensitively', () => {
    const r = redact({ a: { PIN: '1111', deep: [{ Cookie: 'c' }] } }) as {
      a: { PIN: string; deep: [{ Cookie: string }] };
    };
    expect(r.a.PIN).toBe('[redacted]');
    expect(r.a.deep[0].Cookie).toBe('[redacted]');
  });

  it('respects the minimum level', () => {
    const lines: string[] = [];
    const logger = createLogger('warn', (l) => lines.push(l));
    logger.info('quiet');
    logger.warn('loud');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('loud');
  });
});
