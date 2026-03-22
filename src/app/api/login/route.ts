import { NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";
import { verify as argon2Verify } from "argon2";
import { authenticator } from "otplib";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { logLoginAttempt } from "@/lib/auditLog";
import { getAppConfig } from "@/lib/vault";
import { verifySecretKeyHash } from "@/lib/secretKey";

function signToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("hex");
}

/** Verify master password against Argon2id hash (production) or plaintext (dev). */
async function verifyMasterPassword(password: string): Promise<boolean> {
  const hash = process.env.MASTER_PASSWORD_HASH;

  if (hash) {
    try {
      return await argon2Verify(hash, password);
    } catch {
      return false;
    }
  }

  // Dev plaintext fallback — only outside production
  if (process.env.NODE_ENV === "production") {
    console.error("[login] MASTER_PASSWORD_HASH not set — required in production.");
    return false;
  }

  const master = process.env.MASTER_PASSWORD;
  if (!master) return false;

  // Constant-time comparison
  const a = Buffer.from(password);
  const b = Buffer.from(master);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

const DELAY = () => new Promise((r) => setTimeout(r, 300 + Math.random() * 200));

export async function POST(request: Request) {
  // ── Rate limiting: 10 attempts / 15 min per IP ──────────────
  const ip = getClientIp(request);
  const rl = checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000);

  if (!rl.allowed) {
    const retryAfterSec = Math.ceil((rl.retryAfterMs ?? 60000) / 1000);
    logLoginAttempt(ip, false);
    return NextResponse.json(
      { error: `Too many login attempts. Try again in ${retryAfterSec} seconds.` },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  const sessionSecret = process.env.NEXTAUTH_SECRET;
  if (!sessionSecret) {
    return NextResponse.json({ error: "Server misconfigured." }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const inputPassword = body.password as string | undefined;
  const inputSecretKey = body.secretKey as string | undefined;

  if (!inputPassword || typeof inputPassword !== "string") {
    logLoginAttempt(ip, false);
    return NextResponse.json({ error: "Password is required." }, { status: 401 });
  }

  // ── Fetch app config once ────────────────────────────────────
  const appConfig = await getAppConfig();

  // ── Secret Key verification (Vault-based, new approach) ──────
  const skEnabledVault = appConfig.secretKeyEnabled === true && !!appConfig.secretKeyHash;
  // Legacy env-var approach (combined hash) — honoured if Vault SK not configured
  const skEnabledEnv = !skEnabledVault && process.env.SECRET_KEY_REQUIRED === "true";

  if (skEnabledVault) {
    if (!inputSecretKey) {
      logLoginAttempt(ip, false);
      return NextResponse.json(
        { error: "Secret Key is required. Open the app on a trusted device or enter it from your Security Kit." },
        { status: 401 },
      );
    }
    const skOk = verifySecretKeyHash(inputSecretKey, appConfig.secretKeyHash!, sessionSecret);
    if (!skOk) {
      logLoginAttempt(ip, false);
      await DELAY();
      return NextResponse.json({ error: "Incorrect Secret Key." }, { status: 401 });
    }
  }

  // ── Master password verification ─────────────────────────────
  // Legacy: when env-var SK mode is active, password was hashed as "SK:password"
  const passwordToVerify =
    skEnabledEnv && inputSecretKey
      ? `${inputSecretKey}:${inputPassword}`
      : inputPassword;

  if (skEnabledEnv && !inputSecretKey) {
    logLoginAttempt(ip, false);
    return NextResponse.json(
      { error: "Secret Key is required. Open the app on a trusted device or enter it from your Security Kit." },
      { status: 401 },
    );
  }

  const passwordOk = await verifyMasterPassword(passwordToVerify);
  if (!passwordOk) {
    logLoginAttempt(ip, false);
    await DELAY();
    return NextResponse.json({ error: "Incorrect master password." }, { status: 401 });
  }

  // ── TOTP verification (after password is correct) ────────────
  if (appConfig.totpEnabled && appConfig.totpSecret) {
    const inputTotp = body.totpCode as string | undefined;
    if (!inputTotp) {
      return NextResponse.json(
        { error: "2FA code required.", requireTotp: true },
        { status: 401 },
      );
    }
    const totpValid = authenticator.verify({
      token: inputTotp,
      secret: appConfig.totpSecret,
    });
    if (!totpValid) {
      logLoginAttempt(ip, false);
      await DELAY();
      return NextResponse.json({ error: "Incorrect 2FA code." }, { status: 401 });
    }
  }

  logLoginAttempt(ip, true);
  checkRateLimit(`login:${ip}`, 0, 0); // Reset counter on success

  // ── Issue signed session cookie ──────────────────────────────
  const token = randomBytes(32).toString("hex");
  const signature = signToken(token, sessionSecret);

  const res = NextResponse.json({ ok: true });
  res.cookies.set("pm_session", `${token}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return res;
}
