import { NextResponse } from "next/server";
import { hash as argon2Hash } from "argon2";

/**
 * POST { password } — hashes a master password with Argon2id.
 * Used only during initial setup via the settings UI.
 * Protected by session middleware — only authenticated users can call this.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const password = body.password as string | undefined;

  if (!password || typeof password !== "string" || password.length < 1) {
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  try {
    const hash = await argon2Hash(password, {
      type: 2, // argon2id
      memoryCost: 65536, // 64 MiB
      timeCost: 3,
      parallelism: 1,
    });
    return NextResponse.json({ hash });
  } catch {
    return NextResponse.json({ error: "Hashing failed." }, { status: 500 });
  }
}
