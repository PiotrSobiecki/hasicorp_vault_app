/** Walidacja danych wejściowych dla wpisów z hasłami. */

const MAX_SHORT = 500;   // tytuł, username, url
const MAX_LONG  = 10000; // hasło, klucz, notatki

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
  if (v.length > max) throw new Error(`${field} jest za długie (max ${max} znaków).`);
  return v;
}

export function validatePasswordInput(
  body: unknown,
): ValidationResult | ValidationError {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Nieprawidłowe dane wejściowe." };
  }

  const d = body as Record<string, unknown>;

  try {
    const title    = str(d.title,    MAX_SHORT, "Tytuł");
    const username = str(d.username, MAX_SHORT, "Nazwa użytkownika");
    const password = str(d.password, MAX_LONG,  "Hasło");

    if (!title?.trim())    return { ok: false, error: "Tytuł jest wymagany." };
    if (!username?.trim()) return { ok: false, error: "Nazwa użytkownika jest wymagana." };
    if (!password)         return { ok: false, error: "Hasło jest wymagane." };

    const url           = str(d.url,           MAX_SHORT, "URL")           ?? undefined;
    const key           = str(d.key,           MAX_LONG,  "Klucz")         ?? undefined;
    const notes         = str(d.notes,         MAX_LONG,  "Notatki")       ?? undefined;
    const twoFactorCode = str(d.twoFactorCode, MAX_SHORT, "Kod 2FA")       ?? undefined;

    if (url && !/^https?:\/\//i.test(url)) {
      return { ok: false, error: "URL musi zaczynać się od http:// lub https://." };
    }

    return {
      ok: true,
      data: { title: title.trim(), username: username.trim(), password, key, url, notes, twoFactorCode },
    };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Błąd walidacji." };
  }
}
