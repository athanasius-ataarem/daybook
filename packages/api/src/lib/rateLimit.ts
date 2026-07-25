// In-memory sliding-window rate limiter. One PM2 process, no Redis — by
// design. The account lock itself lives on the user row and survives restarts;
// this limiter only slows request floods.

interface Window {
  hits: number[];
}

export class RateLimiter {
  private windows = new Map<string, Window>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** Returns true when the call is allowed, false when over the limit. */
  allow(key: string, now: number = Date.now()): boolean {
    let w = this.windows.get(key);
    if (!w) {
      w = { hits: [] };
      this.windows.set(key, w);
    }
    const cutoff = now - this.windowMs;
    w.hits = w.hits.filter((t) => t > cutoff);
    if (w.hits.length >= this.max) return false;
    w.hits.push(now);
    // Opportunistic cleanup so the map cannot grow without bound.
    if (this.windows.size > 10_000) {
      for (const [k, win] of this.windows) {
        if (win.hits.every((t) => t <= cutoff)) this.windows.delete(k);
      }
    }
    return true;
  }
}
