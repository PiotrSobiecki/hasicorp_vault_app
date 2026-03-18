/**
 * Prosty in-memory rate limiter (single-instance).
 * Dla Railway (jednoprocesorowe wdrożenie) w pełni wystarczający.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

// Automatyczne czyszczenie starych wpisów co 5 minut
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of store) {
    if (now > bucket.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Sprawdza czy dany klucz (np. IP) nie przekroczył limitu.
 *
 * @param key       identyfikator – najczęściej adres IP
 * @param limit     maksymalna liczba prób w oknie
 * @param windowMs  długość okna w milisekundach
 * @returns `allowed` = true jeśli żądanie jest dozwolone
 *          `remaining` = ile prób pozostało
 *          `retryAfterMs` = ile ms do resetu (tylko gdy zablokowany)
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

/** Wyciąga IP klienta z nagłówków (Railway/proxy aware). */
export function getClientIp(request: Request): string {
  const fwd = (request.headers as Headers).get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return (request.headers as Headers).get("x-real-ip") ?? "unknown";
}
