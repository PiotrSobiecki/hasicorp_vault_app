import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

/**
 * Server-side session check for API route handlers.
 *
 * The middleware already validates `pm_session`, but middleware is a single
 * point of failure: CVE-2025-29927 (Next.js < 15.2.3) lets a request skip it
 * entirely with the `x-middleware-subrequest` header. Every protected route
 * therefore re-verifies the cookie here, in the Node.js runtime, with the
 * same format and rules as `src/middleware.ts`.
 */

const SESSION_COOKIE = "pm_session";
const PASSWORD_REAUTH_SECONDS = 10 * 24 * 60 * 60;

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

function signatureValid(message: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(message).digest("hex");
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

/** Returns true when the request carries a valid, non-expired session cookie. */
export function hasValidSession(request: Request): boolean {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return false;

  const cookie = readCookie(request, SESSION_COOKIE);
  if (!cookie) return false;

  const parts = cookie.split(".");
  if (parts.length !== 3) return false;
  const [token, issuedAtStr, signature] = parts;
  if (!token || !issuedAtStr || !signature) return false;

  const issuedAt = parseInt(issuedAtStr, 10);
  if (Number.isNaN(issuedAt)) return false;

  if (!signatureValid(`${token}.${issuedAtStr}`, signature, secret)) return false;

  const now = Math.floor(Date.now() / 1000);
  return now - issuedAt <= PASSWORD_REAUTH_SECONDS;
}

/**
 * Guard for route handlers: returns a 401 response to send back, or null
 * when the session is valid and the handler may continue.
 */
export function requireSession(request: Request): NextResponse | null {
  if (hasValidSession(request)) return null;
  return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
}
