import { NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";
import { verify as argon2Verify } from "argon2";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

function signToken(token: string, secret: string): string {
  return createHmac("sha256", secret).update(token).digest("hex");
}

/**
 * Weryfikuje hasło względem hasha Argon2id (MASTER_PASSWORD_HASH)
 * lub jako fallback względem plaintext (MASTER_PASSWORD) dla środowiska dev.
 *
 * Na produkcji ustaw MASTER_PASSWORD_HASH (wygenerowany przez scripts/hash-password.mjs)
 * i usuń MASTER_PASSWORD z .env.
 */
async function verifyMasterPassword(input: string): Promise<boolean> {
  const hash = process.env.MASTER_PASSWORD_HASH;

  // ── Tryb produkcyjny: Argon2id hash ─────────────────────────
  if (hash) {
    try {
      return await argon2Verify(hash, input);
    } catch {
      return false;
    }
  }

  // ── Tryb dev: plaintext fallback (tylko poza produkcją) ──────
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[login] MASTER_PASSWORD_HASH nie jest ustawiony! Na produkcji wymagany jest hash Argon2id.",
    );
    return false;
  }

  const master = process.env.MASTER_PASSWORD;
  if (!master) return false;

  // Stałoczasowe porównanie dla plaintext (dev)
  const a = Buffer.from(input);
  const b = Buffer.from(master);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function POST(request: Request) {
  // ── Rate limiting: 10 prób / 15 min per IP ─────────────────
  const ip = getClientIp(request);
  const rl = checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000);

  if (!rl.allowed) {
    const retryAfterSec = Math.ceil((rl.retryAfterMs ?? 60000) / 1000);
    return NextResponse.json(
      { error: `Zbyt wiele prób logowania. Spróbuj ponownie za ${retryAfterSec} sekund.` },
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
    return NextResponse.json(
      { error: "Serwer nie jest prawidłowo skonfigurowany." },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const inputPassword = body.password as string | undefined;

  if (!inputPassword || typeof inputPassword !== "string") {
    return NextResponse.json({ error: "Hasło jest wymagane." }, { status: 401 });
  }

  const ok = await verifyMasterPassword(inputPassword);

  if (!ok) {
    // Stałe opóźnienie – nie zdradzamy czy hasło jest bliskie
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 200));
    return NextResponse.json(
      { error: "Nieprawidłowe hasło główne." },
      { status: 401 },
    );
  }

  // ── Reset licznika po udanym logowaniu ──────────────────────
  checkRateLimit(`login:${ip}`, 0, 0);

  // ── Wygeneruj podpisany token sesji ─────────────────────────
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
