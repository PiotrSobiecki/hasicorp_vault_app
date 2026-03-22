/**
 * Simple in-memory rate limiter (single-instance).
 * Sufficient for Railway single-process deployments.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

// Auto-clean stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of store) {
    if (now > bucket.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Check whether a given key (e.g. IP) has exceeded the limit.
 *
 * @param key       identifier — usually an IP address
 * @param limit     maximum attempts within the window
 * @param windowMs  window length in milliseconds
 * @returns `allowed` = true if the request is permitted
 *          `remaining` = attempts left
 *          `retryAfterMs` = ms until reset (only when blocked)
 */
export function checkRateLimit(
  key: string,
  limit = 10,
  windowMs = 15 * 60 * 1000,
): { allowed: boolean; remaining: number; retryAfterMs?: number } {
  const now = Date.now();
  let bucket = store.get(key);

  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    store.set(key, bucket);
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: bucket.resetAt - now,
    };
  }

  bucket.count++;
  return { allowed: true, remaining: limit - bucket.count };
}

/** Extract client IP from headers (Railway/proxy aware). */
export function getClientIp(request: Request): string {
  const fwd = (request.headers as Headers).get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return (request.headers as Headers).get("x-real-ip") ?? "unknown";
}
