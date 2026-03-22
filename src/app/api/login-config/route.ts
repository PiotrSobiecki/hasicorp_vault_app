import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/vault";

// Public endpoint — called before login to know which fields to show.
export async function GET() {
  try {
    const config = await getAppConfig();
    return NextResponse.json({
      totpRequired: config.totpEnabled === true,
      // SK enabled via Vault UI takes precedence; env var is legacy fallback
      secretKeyRequired: config.secretKeyEnabled === true || process.env.SECRET_KEY_REQUIRED === "true",
    });
  } catch {
    // If Vault is down, return safe defaults (login will fail anyway)
    return NextResponse.json({
      totpRequired: false,
      secretKeyRequired: process.env.SECRET_KEY_REQUIRED === "true",
    });
  }
}
