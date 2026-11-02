import { requireSession } from "@/lib/session";
import { NextResponse } from "next/server";
import { generateSecretKey, hashSecretKey } from "@/lib/secretKey";
import { getAppConfig, saveAppConfig } from "@/lib/vault";

/** GET — current Secret Key status */
export async function GET(request: Request) {
  const denied = requireSession(request);
  if (denied) return denied;

  const config = await getAppConfig();
  return NextResponse.json({ enabled: config.secretKeyEnabled === true });
}

/**
 * POST — generate a new Secret Key (rotates any existing key).
 * Returns the plaintext key ONCE — must be saved by the user.
 */
export async function POST(request: Request) {
  const denied = requireSession(request);
  if (denied) return denied;

  const serverSecret = process.env.NEXTAUTH_SECRET;
  if (!serverSecret) {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });
  }

  const sk = generateSecretKey(); // already includes SK- prefix
  const hash = hashSecretKey(sk, serverSecret);

  await saveAppConfig({ secretKeyEnabled: true, secretKeyHash: hash });

  return NextResponse.json({ secretKey: sk });
}

/** DELETE — disable Secret Key requirement */
export async function DELETE(request: Request) {
  const denied = requireSession(request);
  if (denied) return denied;

  await saveAppConfig({ secretKeyEnabled: false, secretKeyHash: "" });
  return NextResponse.json({ ok: true });
}
