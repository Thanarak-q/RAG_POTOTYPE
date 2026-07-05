import { describe, expect, it } from 'vitest';
import { createInMemoryRateLimiter } from '../src/lib/rateLimit';

describe('createInMemoryRateLimiter', () => {
  it('allows requests up to the configured limit and rejects the next one', () => {
    const limiter = createInMemoryRateLimiter({
      limit: 2,
      windowMs: 1000,
      now: () => 10,
    });

    expect(limiter.check('line-user')).toEqual({ allowed: true, remaining: 1 });
    expect(limiter.check('line-user')).toEqual({ allowed: true, remaining: 0 });
    expect(limiter.check('line-user')).toEqual({
      allowed: false,
      remaining: 0,
    });
  });

  it('resets after the window expires', () => {
    let now = 10;
    const limiter = createInMemoryRateLimiter({
      limit: 1,
      windowMs: 1000,
      now: () => now,
    });

    expect(limiter.check('admin')).toEqual({ allowed: true, remaining: 0 });
    expect(limiter.check('admin').allowed).toBe(false);
    now = 1011;
    expect(limiter.check('admin')).toEqual({ allowed: true, remaining: 0 });
  });
});
