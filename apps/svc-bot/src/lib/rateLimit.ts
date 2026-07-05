export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
}

export function createInMemoryRateLimiter(options: {
  limit: number;
  windowMs: number;
  now?: () => number;
}): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  const now = options.now ?? Date.now;

  return {
    check(key: string): RateLimitResult {
      const currentTime = now();
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= currentTime) {
        buckets.set(key, { count: 1, resetAt: currentTime + options.windowMs });
        return { allowed: true, remaining: options.limit - 1 };
      }

      if (bucket.count >= options.limit) {
        return { allowed: false, remaining: 0 };
      }

      const nextCount = bucket.count + 1;
      buckets.set(key, { ...bucket, count: nextCount });
      return { allowed: true, remaining: options.limit - nextCount };
    },
  };
}

export const lineWebhookRateLimiter = createInMemoryRateLimiter({
  limit: 10,
  windowMs: 60_000,
});

export const internalApiRateLimiter = createInMemoryRateLimiter({
  limit: 30,
  windowMs: 60_000,
});
