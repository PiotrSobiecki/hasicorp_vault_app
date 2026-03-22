import { NextResponse } from "next/server";
import { authenticator } from "otplib";
import { getAppConfig, saveAppConfig } from "@/lib/vault";

/** GET — current TOTP status (enabled/disabled, no secret exposed) */
export async function GET() {
  const config = await getAppConfig();
  return NextResponse.json({ enabled: config.totpEnabled === true });
}

/**
 * POST — two actions:
 *   { action: "generate" }              → generates a new secret, returns otpauthUri
 *   { action: "verify", secret, code }  → verifies code, saves to Vault, enables TOTP
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (body.action === "generate") {
    const secret = authenticator.generateSecret(20); // 160-bit
    const otpauthUri = authenticator.keyuri("VaultManager", "Vault Manager", secret);
    return NextResponse.json({ secret, otpauthUri });
  }

  if (body.action === "verify") {
    const { secret, code } = body as { secret?: string; code?: string };
    if (!secret || !code) {
      return NextResponse.json({ error: "Missing code or secret." }, { status: 400 });
    }
    const valid = authenticator.verify({ token: code, secret });
    if (!valid) {
      return NextResponse.json({ error: "Invalid code. Check the time on your device." }, { status: 400 });
    }
    await saveAppConfig({ totpSecret: secret, totpEnabled: true });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

/** DELETE — disable TOTP (requires current code for confirmation) */
export async function DELETE(request: Request) {
  const body = await request.json().catch(() => ({}));
  const config = await getAppConfig();

  if (config.totpEnabled && config.totpSecret) {
    const valid = authenticator.verify({
      token: body.code ?? "",
      secret: config.totpSecret,
    });
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid 2FA code. Confirm with your current code to disable." },
        { status: 400 },
      );
    }
  }

  await saveAppConfig({ totpSecret: "", totpEnabled: false });
  return NextResponse.json({ ok: true });
}
