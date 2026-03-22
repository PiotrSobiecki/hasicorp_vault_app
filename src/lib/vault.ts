import { Password } from "@/types/password";

/** Minimal shape of a Vault KV v2 data response */
interface VaultKVResponse {
  data?: {
    data?: Record<string, string>;
    keys?: string[];
  };
}

const VAULT_ADDR = process.env.VAULT_ADDR!;
const VAULT_TOKEN = process.env.VAULT_TOKEN!;
const VAULT_MOUNT_NAME =
  process.env.VAULT_MOUNT_NAME || process.env.MOUNT_NAME || "secret";
const VAULT_PASSWORDS_PATH = process.env.VAULT_PASSWORDS_PATH || "passwords";

if (!VAULT_ADDR || !VAULT_TOKEN) {
  // In Next.js server environment, throw on first use so the developer
  // sees the problem immediately in the logs.
  console.warn(
    "[vault] VAULT_ADDR or VAULT_TOKEN is not set — password API will not work.",
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
      ...(opts.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Vault API error ${res.status}: ${text}`);
  }

  if (opts.raw) {
    return res as unknown as T;
  }

  // 204 No Content (e.g. DELETE metadata) — no body, return empty object
  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

async function listIds(): Promise<string[]> {
  try {
    const json = await vaultRequest<VaultKVResponse>(
      `${VAULT_MOUNT_NAME}/metadata/${VAULT_PASSWORDS_PATH}`,
      { method: "LIST" },
    );
    const keys: string[] = json.data?.keys ?? [];
    // keys from Vault may have a trailing "/"
    return keys.map((k) => k.replace(/\/$/, ""));
  } catch (e) {
    // If nothing exists at this path — Vault returns 404, treat as empty list
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
      const json = await vaultRequest<VaultKVResponse>(
        `${VAULT_MOUNT_NAME}/data/${dataPath(id)}`,
        { method: "GET" },
      );
      const d = json.data?.data ?? {};
      result.push({
        id,
        title: d.title ?? "",
        username: d.username ?? "",
        password: d.password ?? "",
        key: d.key ?? undefined,
        url: d.url ?? undefined,
        notes: d.notes ?? undefined,
        twoFactorCode: d.twoFactorCode ?? undefined,
      });
    } catch {
      // Skip entries that cannot be read
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
    const json = await vaultRequest<VaultKVResponse>(
      `${VAULT_MOUNT_NAME}/data/${dataPath(id)}`,
      { method: "GET" },
    );
    const d = json.data?.data ?? {};
    return {
      id,
      title: d.title ?? "",
      username: d.username ?? "",
      password: d.password ?? "",
      key: d.key ?? undefined,
      url: d.url ?? undefined,
      notes: d.notes ?? undefined,
      twoFactorCode: d.twoFactorCode ?? undefined,
    };
  } catch (e) {
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
  // Delete metadata (all versions) — hard delete
  await vaultRequest(`${VAULT_MOUNT_NAME}/metadata/${dataPath(id)}`, {
    method: "DELETE",
  });
}

// ── App config (TOTP etc.) stored at a fixed Vault path ──────

const APP_CONFIG_PATH = "app/config";

export interface AppConfig {
  totpSecret?: string;
  totpEnabled?: boolean;
  secretKeyEnabled?: boolean;
  /** HMAC-SHA256(secretKey, NEXTAUTH_SECRET) — never store the key itself */
  secretKeyHash?: string;
}

export async function getAppConfig(): Promise<AppConfig> {
  try {
    const json = await vaultRequest<VaultKVResponse>(
      `${VAULT_MOUNT_NAME}/data/${APP_CONFIG_PATH}`,
      { method: "GET" },
    );
    const d = json.data?.data ?? {};
    return {
      totpSecret: d.totpSecret ?? undefined,
      totpEnabled: d.totpEnabled === "true",
      secretKeyEnabled: d.secretKeyEnabled === "true",
      secretKeyHash: d.secretKeyHash ?? undefined,
    };
  } catch (e) {
    if (e instanceof Error && /404/.test(e.message)) return {};
    throw e;
  }
}

export async function saveAppConfig(config: AppConfig): Promise<void> {
  // Merge with existing config to avoid overwriting unrelated fields
  const current = await getAppConfig();
  const merged = { ...current, ...config };
  await vaultRequest(`${VAULT_MOUNT_NAME}/data/${APP_CONFIG_PATH}`, {
    method: "POST",
    body: JSON.stringify({
      data: {
        totpSecret: merged.totpSecret ?? "",
        totpEnabled: String(merged.totpEnabled ?? false),
        secretKeyEnabled: String(merged.secretKeyEnabled ?? false),
        secretKeyHash: merged.secretKeyHash ?? "",
      },
    }),
  });
}
