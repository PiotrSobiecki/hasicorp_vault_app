/**
 * Szyfrowanie AES-256-GCM (Node.js crypto).
 *
 * Format zaszyfrowanego stringa (base64url):
 *   [ IV (12 B) | AuthTag (16 B) | Ciphertext (n B) ]
 *
 * Backward-compat: stare pliki eksportowane przez CryptoJS
 * (format OpenSSL, zaczyna się od "U2FsdGVkX1") są nadal
 * deszyfrowane ścieżką legacy.
 */
import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "crypto";
import CryptoJS from "crypto-js"; // tylko legacy decrypt

const LEGACY_PREFIX = "U2FsdGVkX1"; // base64("Salted__")

/** Wyprowadź 32-bajtowy klucz AES-256 z dowolnego stringa kluczowego. */
function deriveKey(secretKey: string): Buffer {
  return createHash("sha256").update(Buffer.from(secretKey, "utf8")).digest();
}

/** Szyfruje tekst do formatu AES-256-GCM (base64url). */
export function encrypt(text: string, secretKey: string): string {
  const key = deriveKey(secretKey);
  const iv = randomBytes(12); // 96-bit IV — zalecany dla GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // 16 B — uwierzytelnienie

  // Sklejamy: iv | authTag | ciphertext → base64url (URL-safe, bez paddingu)
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64url");
}

/** Deszyfruje tekst.  Obsługuje oba formaty: nowy AES-GCM i stary CryptoJS. */
export function decrypt(ciphertext: string, secretKey: string): string {
  // ── Legacy: stare eksporty z CryptoJS ──────────────────────
  if (ciphertext.startsWith(LEGACY_PREFIX) || ciphertext.startsWith("U2Fs")) {
    const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
    const result = bytes.toString(CryptoJS.enc.Utf8);
    if (!result) throw new Error("Nieprawidłowy klucz lub uszkodzony plik (legacy).");
    return result;
  }

  // ── Nowy format: AES-256-GCM ────────────────────────────────
  const combined = Buffer.from(ciphertext, "base64url");
  if (combined.length < 12 + 16 + 1) {
    throw new Error("Nieprawidłowy format zaszyfrowanych danych.");
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
    throw new Error("Weryfikacja integralności nieudana – plik może być uszkodzony lub klucz jest błędny.");
  }
}
