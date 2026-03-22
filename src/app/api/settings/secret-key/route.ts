import { NextResponse } from "next/server";
import { generateSecretKey, hashSecretKey } from "@/lib/secretKey";
import { getAppConfig, saveAppConfig } from "@/lib/vault";

/** GET — current Secret Key status */
export async function GET() {
  const config = await getAppConfig();
  return NextResponse.json({ enabled: config.secretKeyEnabled === true });
}

/**
 * POST — generate a new Secret Key (rotates any existing key).
 * Returns the plaintext key ONCE — must be saved by the user.
 */
export async function POST() {
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
export async function DELETE() {
  await saveAppConfig({ secretKeyEnabled: false, secretKeyHash: "" });
  return NextResponse.json({ ok: true });
}
