import { describe, expect, it } from 'vitest';
import { RateLimiter } from '../src/lib/rateLimit';

describe('RateLimiter', () => {
  it('allows up to max within the window, then blocks', () => {
    const rl = new RateLimiter(3, 60_000);
    const t = 1_000_000;
    expect(rl.allow('k', t)).toBe(true);
    expect(rl.allow('k', t + 1)).toBe(true);
    expect(rl.allow('k', t + 2)).toBe(true);
    expect(rl.allow('k', t + 3)).toBe(false);
  });

  it('frees slots as the window slides', () => {
    const rl = new RateLimiter(2, 60_000);
    const t = 1_000_000;
    rl.allow('k', t);
    rl.allow('k', t + 1);
    expect(rl.allow('k', t + 2)).toBe(false);
    expect(rl.allow('k', t + 60_001)).toBe(true);
  });

  it('keys are independent', () => {
    const rl = new RateLimiter(1, 60_000);
    expect(rl.allow('a', 0)).toBe(true);
    expect(rl.allow('b', 0)).toBe(true);
    expect(rl.allow('a', 1)).toBe(false);
  });
});
