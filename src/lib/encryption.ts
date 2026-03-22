/**
 * AES-256-GCM encryption (Node.js crypto).
 *
 * Encrypted string format (base64url):
 *   [ IV (12 B) | AuthTag (16 B) | Ciphertext (n B) ]
 *
 * Backward-compat: old exports created with CryptoJS
 * (OpenSSL format, starting with "U2FsdGVkX1") are still
 * decrypted via the legacy path.
 */
import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "crypto";
import CryptoJS from "crypto-js"; // legacy decrypt only

const LEGACY_PREFIX = "U2FsdGVkX1"; // base64("Salted__")

/** Derive a 32-byte AES-256 key from any key string. */
function deriveKey(secretKey: string): Buffer {
  return createHash("sha256").update(Buffer.from(secretKey, "utf8")).digest();
}

/** Encrypt text to AES-256-GCM format (base64url). */
export function encrypt(text: string, secretKey: string): string {
  const key = deriveKey(secretKey);
  const iv = randomBytes(12); // 96-bit IV — recommended for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // 16 B — authentication tag

  // Concatenate: iv | authTag | ciphertext → base64url (URL-safe, no padding)
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64url");
}

/** Decrypt text. Supports both formats: new AES-GCM and legacy CryptoJS. */
export function decrypt(ciphertext: string, secretKey: string): string {
  // ── Legacy: old CryptoJS exports ──────────────────────────
  if (ciphertext.startsWith(LEGACY_PREFIX) || ciphertext.startsWith("U2Fs")) {
    const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
    const result = bytes.toString(CryptoJS.enc.Utf8);
    if (!result) throw new Error("Invalid key or corrupted file (legacy).");
    return result;
  }

  // ── New format: AES-256-GCM ────────────────────────────────
  const combined = Buffer.from(ciphertext, "base64url");
  if (combined.length < 12 + 16 + 1) {
    throw new Error("Invalid encrypted data format.");
  }

  const key = deriveKey(secretKey);
  const iv      = combined.subarray(0, 12);
  const authTag = combined.subarray(12, 28);
  const data    = combined.subarray(28);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  try {
    return Buffer.concat([
      decipher.update(data),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Integrity verification failed — file may be corrupted or key is incorrect.");
  }
}
