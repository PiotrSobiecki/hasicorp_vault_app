import { Password } from "@/types/password";

const VAULT_ADDR = process.env.VAULT_ADDR!;
const VAULT_TOKEN = process.env.VAULT_TOKEN!;
const VAULT_MOUNT_NAME =
  process.env.VAULT_MOUNT_NAME || process.env.MOUNT_NAME || "secret";
const VAULT_PASSWORDS_PATH = process.env.VAULT_PASSWORDS_PATH || "passwords";

if (!VAULT_ADDR || !VAULT_TOKEN) {
  // W środowisku serwerowym Next wyrzucimy błąd dopiero przy pierwszym użyciu funkcji,
  // żeby dev od razu zobaczył problem w logach.
  console.warn(
    "[vault] VAULT_ADDR lub VAULT_TOKEN nie są ustawione – API haseł nie będzie działać.",
  );
}

function vaultBaseUrl() {
  return VAULT_ADDR.replace(/\/$/, "");
}

function dataPath(id: string) {
  return `${VAULT_PASSWORDS_PATH}/${encodeURIComponent(id)}`;
}

async function vaultRequest<T>(
  path: string,
  opts: RequestInit & { raw?: boolean } = {},
): Promise<T> {
  const url = `${vaultBaseUrl()}/v1/${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      "X-Vault-Token": VAULT_TOKEN,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });

  if (!res.ok) {
    // 404 dla listy traktujemy wyżej, tutaj rzucamy błąd
    const text = await res.text().catch(() => "");
    throw new Error(`Vault API error ${res.status}: ${text}`);
  }

  if ((opts as any).raw) {
    return res as any as T;
  }

  // 204 No Content (np. DELETE metadata) – brak body, zwracamy pusty obiekt
  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

async function listIds(): Promise<string[]> {
  try {
    const json = await vaultRequest<any>(
      `${VAULT_MOUNT_NAME}/metadata/${VAULT_PASSWORDS_PATH}`,
      { method: "LIST" },
    );
    const keys: string[] = json.data?.keys || [];
    // keys z Vault mogą mieć końcowy "/"
    return keys.map((k) => k.replace(/\/$/, ""));
  } catch (e: any) {
    // Jeśli nic nie ma pod tym path – Vault zwraca 404, traktujemy jako pustą listę
    if (e instanceof Error && /404/.test(e.message)) {
      return [];
    }
    throw e;
  }
}

export async function listVaultPasswords(): Promise<Password[]> {
  const ids = await listIds();
  const result: Password[] = [];

  for (const id of ids) {
    try {
      const json = await vaultRequest<any>(
        `${VAULT_MOUNT_NAME}/data/${dataPath(id)}`,
        { method: "GET" },
      );
      const d = json.data?.data || {};
      result.push({
        id,
        title: d.title || "",
        username: d.username || "",
        password: d.password || "",
        key: d.key || undefined,
        url: d.url || undefined,
        notes: d.notes || undefined,
        twoFactorCode: d.twoFactorCode || undefined,
      });
    } catch {
      // Pomijamy wpisy, których nie da się odczytać
      continue;
    }
  }

  return result;
}

export type PasswordInput = Omit<Password, "id">;

export async function createVaultPassword(
  data: PasswordInput,
): Promise<Password> {
  const id = crypto.randomUUID();
  await vaultRequest(`${VAULT_MOUNT_NAME}/data/${dataPath(id)}`, {
    method: "POST",
    body: JSON.stringify({
      data: {
        ...data,
        id,
      },
    }),
  });

  return { id, ...data };
}

export async function getVaultPassword(id: string): Promise<Password | null> {
  try {
    const json = await vaultRequest<any>(
      `${VAULT_MOUNT_NAME}/data/${dataPath(id)}`,
      { method: "GET" },
    );
    const d = json.data?.data || {};
    return {
      id,
      title: d.title || "",
      username: d.username || "",
      password: d.password || "",
      key: d.key || undefined,
      url: d.url || undefined,
      notes: d.notes || undefined,
      twoFactorCode: d.twoFactorCode || undefined,
    };
  } catch (e: any) {
    if (e instanceof Error && /404/.test(e.message)) {
      return null;
    }
    throw e;
  }
}

export async function updateVaultPassword(
  id: string,
  data: PasswordInput,
): Promise<Password> {
  await vaultRequest(`${VAULT_MOUNT_NAME}/data/${dataPath(id)}`, {
    method: "POST",
    body: JSON.stringify({
      data: {
        ...data,
        id,
      },
    }),
  });

  return { id, ...data };
}

export async function deleteVaultPassword(id: string): Promise<void> {
  // Usuwamy metadane (wszystkie wersje) – twarde usunięcie
  await vaultRequest(`${VAULT_MOUNT_NAME}/metadata/${dataPath(id)}`, {
    method: "DELETE",
  });
}
