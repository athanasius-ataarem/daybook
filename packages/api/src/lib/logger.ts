// A small JSON-lines logger with mandatory redaction. `pin`, `pinHash` and
// `cookie` (any casing) must never reach output — asserted by a unit test.

const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50 } as const;
export type LogLevel = keyof typeof LEVELS;

const REDACT_KEYS = new Set(['pin', 'pinhash', 'cookie', 'set-cookie', 'authorization']);

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[deep]';
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT_KEYS.has(k.toLowerCase()) ? '[redacted]' : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

export interface Logger {
  trace: (msg: string, data?: Record<string, unknown>) => void;
  debug: (msg: string, data?: Record<string, unknown>) => void;
  info: (msg: string, data?: Record<string, unknown>) => void;
  warn: (msg: string, data?: Record<string, unknown>) => void;
  error: (msg: string, data?: Record<string, unknown>) => void;
}

export function createLogger(
  minLevel: LogLevel,
  write: (line: string) => void = (line) => process.stdout.write(line + '\n'),
): Logger {
  const emit = (level: LogLevel, msg: string, data?: Record<string, unknown>): void => {
    if (LEVELS[level] < LEVELS[minLevel]) return;
    const record = {
      time: new Date().toISOString(),
      level,
      msg,
      ...(data ? (redact(data) as Record<string, unknown>) : {}),
    };
    write(JSON.stringify(record));
  };
  return {
    trace: (m, d) => emit('trace', m, d),
    debug: (m, d) => emit('debug', m, d),
    info: (m, d) => emit('info', m, d),
    warn: (m, d) => emit('warn', m, d),
    error: (m, d) => emit('error', m, d),
  };
}
