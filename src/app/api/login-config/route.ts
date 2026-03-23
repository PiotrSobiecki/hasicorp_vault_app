import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { getAppConfig } from "@/lib/vault";

function signDeviceToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(`dt:${token}`).digest("hex");
}

function verifyDeviceCookie(cookieValue: string, secret: string): boolean {
  const parts = cookieValue.split(".");
  if (parts.length !== 2) return false;
  const [token, sig] = parts;
  if (!token || !sig) return false;
  const expected = signDeviceToken(token, secret);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
  } catch {
    return false;
  }
}

// Public endpoint — called before login to know which fields to show.
export async function GET(request: NextRequest) {
  const sessionSecret = process.env.NEXTAUTH_SECRET;
  const deviceCookieValue = sessionSecret
    ? request.cookies.get("pm_device")?.value
    : undefined;
  const deviceTrusted = deviceCookieValue && sessionSecret
    ? verifyDeviceCookie(deviceCookieValue, sessionSecret)
    : false;

  try {
    const config = await getAppConfig();
    return NextResponse.json({
      totpRequired: config.totpEnabled === true,
      // SK enabled via Vault UI takes precedence; env var is legacy fallback
      secretKeyRequired: config.secretKeyEnabled === true || process.env.SECRET_KEY_REQUIRED === "true",
      deviceTrusted,
    });
  } catch {
    // If Vault is down, return safe defaults (login will fail anyway)
    return NextResponse.json({
      totpRequired: false,
      secretKeyRequired: process.env.SECRET_KEY_REQUIRED === "true",
      deviceTrusted,
    });
  }
}
