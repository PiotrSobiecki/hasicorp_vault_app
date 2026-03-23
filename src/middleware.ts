import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes that don't require authentication
const PUBLIC_API_ROUTES = new Set(["/api/login", "/api/logout", "/api/favicon", "/api/login-config"]);

const PASSWORD_REAUTH_SECONDS = 48 * 60 * 60;

interface SessionResult {
  valid: boolean;
  needsReauth: boolean;
}

async function verifySession(
  cookieValue: string,
  secret: string,
): Promise<SessionResult> {
  const parts = cookieValue.split(".");
  // Format: {token}.{issuedAt}.{signature}
  if (parts.length !== 3) return { valid: false, needsReauth: false };
  const [token, issuedAtStr, signature] = parts;
  if (!token || !issuedAtStr || !signature) return { valid: false, needsReauth: false };

  const issuedAt = parseInt(issuedAtStr, 10);
  if (isNaN(issuedAt)) return { valid: false, needsReauth: false };

  const message = `${token}.${issuedAtStr}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signature.length) return { valid: false, needsReauth: false };
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  if (diff !== 0) return { valid: false, needsReauth: false };

  // Valid signature — check whether password re-verification is needed (48h)
  const now = Math.floor(Date.now() / 1000);
  if (now - issuedAt > PASSWORD_REAUTH_SECONDS) {
    return { valid: true, needsReauth: true };
  }

  return { valid: true, needsReauth: false };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow login page
  if (pathname === "/login") return NextResponse.next();

  const sessionSecret = process.env.NEXTAUTH_SECRET;
  if (!sessionSecret) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Server misconfigured." },
        { status: 500 },
      );
    }
    return NextResponse.next();
  }

  // Public API routes
  if (PUBLIC_API_ROUTES.has(pathname)) return NextResponse.next();

  const cookie = request.cookies.get("pm_session")?.value;
  const session = cookie
    ? await verifySession(cookie, sessionSecret)
    : { valid: false, needsReauth: false };

  // Protect all API routes
  if (pathname.startsWith("/api/")) {
    if (!session.valid) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    if (session.needsReauth) {
      return NextResponse.json(
        { error: "Password re-verification required.", reauth: true },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  // Redirect unauthenticated users to login for app pages
  if (!session.valid) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to password re-verification if 48h exceeded
  if (session.needsReauth) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("reauth", "1");
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all API routes
    "/api/:path*",
    // Match app pages, but skip Next.js internals and static assets
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp)).*)",
  ],
};
