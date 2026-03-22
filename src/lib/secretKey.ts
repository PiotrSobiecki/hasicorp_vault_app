import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/** Generate SK-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX (25 base32 chars = 125-bit entropy) */
export function generateSecretKey(): string {
  const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const MAX = Math.floor(0x100000000 / CHARSET.length) * CHARSET.length;
  const chars: string[] = [];
  while (chars.length < 25) {
    const n = randomBytes(4).readUInt32BE(0);
    if (n < MAX) chars.push(CHARSET[n % CHARSET.length]);
  }
  return `SK-${[
    chars.slice(0, 5).join(""),
    chars.slice(5, 10).join(""),
    chars.slice(10, 15).join(""),
    chars.slice(15, 20).join(""),
    chars.slice(20, 25).join(""),
  ].join("-")}`;
}

export function hashSecretKey(sk: string, serverSecret: string): string {
  return createHmac("sha256", serverSecret).update(sk).digest("hex");
}

export function verifySecretKeyHash(
  sk: string,
  storedHash: string,
  serverSecret: string,
): boolean {
  const inputHash = hashSecretKey(sk, serverSecret);
  try {
    return timingSafeEqual(
      Buffer.from(inputHash, "hex"),
      Buffer.from(storedHash, "hex"),
    );
  } catch {
    return false;
  }
}
