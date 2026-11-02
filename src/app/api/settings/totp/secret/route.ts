import { requireSession } from "@/lib/session";
import { NextResponse } from "next/server";
import { authenticator } from "otplib";
import { getAppConfig } from "@/lib/vault";

/**
 * GET — returns the TOTP secret and otpauth URI so the user can embed
 * the QR code in their Security Kit PDF or re-scan it.
 * Protected by session middleware — never public.
 */
export async function GET(request: Request) {
  const denied = requireSession(request);
  if (denied) return denied;

  const config = await getAppConfig();

  if (!config.totpEnabled || !config.totpSecret) {
    return NextResponse.json({ enabled: false });
  }

  const otpauthUri = authenticator.keyuri("VaultManager", "Vault Manager", config.totpSecret);

  return NextResponse.json({
    enabled: true,
    secret: config.totpSecret,
    otpauthUri,
  });
}
