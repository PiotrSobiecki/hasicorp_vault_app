/**
 * Emergency script — disables Secret Key requirement directly in Vault.
 * Run from the project root: node scripts/reset-sk.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
const envPath = resolve(process.cwd(), ".env.local");
let envVars = {};
try {
  const raw = readFileSync(envPath, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    envVars[key] = val;
  }
} catch {
  console.error("Could not read .env.local — make sure you run this from the project root.");
  process.exit(1);
}

const VAULT_ADDR = envVars.VAULT_ADDR;
const VAULT_TOKEN = envVars.VAULT_TOKEN;
const MOUNT = envVars.VAULT_MOUNT_NAME || envVars.MOUNT_NAME || "secret";

if (!VAULT_ADDR || !VAULT_TOKEN) {
  console.error("VAULT_ADDR or VAULT_TOKEN not found in .env.local");
  process.exit(1);
}

const base = VAULT_ADDR.replace(/\/$/, "");
const dataUrl = `${base}/v1/${MOUNT}/data/app/config`;
const headers = {
  "X-Vault-Token": VAULT_TOKEN,
  "Content-Type": "application/json",
};

console.log(`Connecting to ${base} ...`);

// 1. Read current config to preserve TOTP settings
const readRes = await fetch(dataUrl, { headers });
let current = {};
if (readRes.ok) {
  const json = await readRes.json();
  current = json?.data?.data ?? {};
  console.log("Current config:", {
    secretKeyEnabled: current.secretKeyEnabled,
    totpEnabled: current.totpEnabled,
    totpSecret: current.totpSecret ? "(set)" : "(empty)",
  });
} else if (readRes.status === 404) {
  console.log("No config found in Vault — will create fresh.");
} else {
  console.error("Failed to read config:", readRes.status, await readRes.text());
  process.exit(1);
}

// 2. Write back with SK disabled, preserving everything else
const newData = {
  ...current,
  secretKeyEnabled: "false",
  secretKeyHash: "",
};

const writeRes = await fetch(dataUrl, {
  method: "POST",
  headers,
  body: JSON.stringify({ data: newData }),
});

if (writeRes.ok) {
  console.log("\n✓ Secret Key disabled successfully.");
  console.log("  You can now log in with just your master password" +
    (current.totpEnabled === "true" ? " + 2FA code." : "."));
  console.log("\n  After logging in, go to Settings → Secret Key → Enable to set up a new key.");
} else {
  console.error("Failed to write config:", writeRes.status, await writeRes.text());
  process.exit(1);
}
