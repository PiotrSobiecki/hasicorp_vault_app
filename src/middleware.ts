import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Public routes that don't require authentication
const PUBLIC_API_ROUTES = new Set(["/api/login", "/api/logout", "/api/favicon", "/api/login-config"]);

async function verifySession(
  cookieValue: string,
  secret: string,
): Promise<boolean> {
  const parts = cookieValue.split(".");
  // Token and signature are both hex strings (no dots), so exactly 2 parts
  if (parts.length !== 2) return false;
  const [token, signature] = parts;
  if (!token || !signature) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(token));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison to prevent timing attacks
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
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
  const isAuthenticated = cookie
    ? await verifySession(cookie, sessionSecret)
    : false;

  // Protect all API routes
  if (pathname.startsWith("/api/")) {
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  // Redirect unauthenticated users to login for app pages
  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
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
