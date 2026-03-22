/** Input validation for password entries. */

const MAX_SHORT = 500;   // title, username, url
const MAX_LONG  = 10000; // password, key, notes

export interface ValidationResult {
  ok: true;
  data: {
    title: string;
    username: string;
    password: string;
    key?: string;
    url?: string;
    notes?: string;
    twoFactorCode?: string;
  };
}

export interface ValidationError {
  ok: false;
  error: string;
}

function str(v: unknown, max: number, field: string): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string") return null;
  if (v.length > max) throw new Error(`${field} is too long (max ${max} characters).`);
  return v;
}

export function validatePasswordInput(
  body: unknown,
): ValidationResult | ValidationError {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid input." };
  }

  const d = body as Record<string, unknown>;

  try {
    const title    = str(d.title,    MAX_SHORT, "Title");
    const username = str(d.username, MAX_SHORT, "Username");
    const password = str(d.password, MAX_LONG,  "Password");

    if (!title?.trim())    return { ok: false, error: "Title is required." };
    if (!username?.trim()) return { ok: false, error: "Username is required." };
    if (!password)         return { ok: false, error: "Password is required." };

    const url           = str(d.url,           MAX_SHORT, "URL")           ?? undefined;
    const key           = str(d.key,           MAX_LONG,  "Key")           ?? undefined;
    const notes         = str(d.notes,         MAX_LONG,  "Notes")         ?? undefined;
    const twoFactorCode = str(d.twoFactorCode, MAX_SHORT, "2FA code")      ?? undefined;

    if (url && !/^https?:\/\//i.test(url)) {
      return { ok: false, error: "URL must start with http:// or https://." };
    }

    return {
      ok: true,
      data: { title: title.trim(), username: username.trim(), password, key, url, notes, twoFactorCode },
    };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Validation error." };
  }
}
