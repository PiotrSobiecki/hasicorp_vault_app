# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Next.js dev server on port 3333
npm run build    # Production build
npm run lint     # ESLint
npm run app      # Launch Electron wrapper (requires Next.js already running)
```

No test suite is configured.

## Architecture

This is a **Next.js 15 App Router** password manager that uses **HashiCorp Vault** as its sole data store. There is no local database — all password entries live in Vault KV v2.

### Authentication flow

Single-user, master-password-based auth:

1. `POST /api/login` — verifies Secret Key (if enabled) → verifies master password (Argon2id, prod) → verifies TOTP (if enabled). On success, sets an HttpOnly `pm_session` cookie: `{randomHex64}.{hmacSha256Hex}`.
2. `src/middleware.ts` — Edge Runtime middleware protects all `/api/*` routes. Reads `pm_session` cookie, verifies HMAC-SHA256 signature using `NEXTAUTH_SECRET`, returns 401 for unauthenticated requests. Public routes: `/api/login`, `/api/logout`, `/api/favicon`, `/api/login-config`.
3. Rate limiting is in-memory (`src/lib/rateLimit.ts`): 10 attempts per IP per 15 min.

Session cookie verification: `createHmac("sha256", secret).update(token).digest("hex") === signature` (constant-time via `timingSafeEqual`).

### Vault storage (`src/lib/vault.ts`)

All CRUD operations go through `vaultRequest()` wrapping Vault's HTTP API with `VAULT_TOKEN`. Passwords are stored at `{VAULT_MOUNT_NAME}/data/{VAULT_PASSWORDS_PATH}/{id}`. App config (TOTP secret, SK hash) lives at `secret/data/app/config`.

```typescript
interface AppConfig {
  totpSecret?: string;
  totpEnabled?: boolean;
  secretKeyEnabled?: boolean;
  secretKeyHash?: string; // HMAC-SHA256(secretKey, NEXTAUTH_SECRET) — key never stored server-side
}
```

Environment variables required:
- `VAULT_ADDR`, `VAULT_TOKEN`, `VAULT_MOUNT_NAME` (default: `secret`), `VAULT_PASSWORDS_PATH` (default: `passwords`)
- `NEXTAUTH_SECRET` — session token signing + SK hash HMAC key
- `MASTER_PASSWORD_HASH` — Argon2id hash (prod); generate with `node scripts/hash-password.mjs`
- `MASTER_PASSWORD` — plaintext fallback for dev only
- `ENCRYPTION_KEY` — export/import file encryption only

**`.env.local` quoting rules:**
- `MASTER_PASSWORD_HASH` must use **single quotes**: `'$argon2id$v=19$...'` — prevents `$` expansion by dotenv-expand
- `MASTER_PASSWORD` must use **double quotes** if it contains `#` — unquoted `#` is treated as comment start

### Secret Key (`src/lib/secretKey.ts`)

Second login factor, required on new devices (like 1Password). Format: `SK-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX` (base32).

- `generateSecretKey()` — returns the `XXXXX-XXXXX-...` portion; prepend `SK-` before storing/displaying
- `hashSecretKey(sk, serverSecret)` — HMAC-SHA256(sk, NEXTAUTH_SECRET); stored in Vault, never the raw key
- `verifySecretKeyHash(sk, storedHash, serverSecret)` — constant-time comparison via `timingSafeEqual`
- Key includes `SK-` prefix when hashing: `const sk = \`SK-${generateSecretKey()}\``; this must match what the user enters

### Encryption (`src/lib/encryption.ts`)

- **New format**: AES-256-GCM, `[IV (12B) | AuthTag (16B) | Ciphertext]`, base64url encoded
- **Legacy format**: CryptoJS AES (prefix `U2FsdGVkX1`) — decrypt only for backward compatibility

### API routes

| Route | Methods | Purpose |
|---|---|---|
| `/api/login` | POST | Authenticate (SK → password → TOTP), set session cookie |
| `/api/logout` | POST | Clear session cookie |
| `/api/login-config` | GET | Public: which factors are required (SK, TOTP) |
| `/api/passwords` | GET, POST | List / create entries in Vault |
| `/api/passwords/[id]` | GET, PUT, DELETE | Read / update / delete single entry |
| `/api/passwords/import` | POST | Replace all Vault entries (add new → delete old) |
| `/api/encrypt` | POST | Encrypt data for file export |
| `/api/passwords/decrypt` | POST | Decrypt an exported file |
| `/api/settings/secret-key` | GET, POST, DELETE | Get SK status / enable (generate+hash) / disable |
| `/api/settings/totp` | GET, POST, DELETE | Get TOTP status / enable+verify / disable |
| `/api/settings/totp/secret` | GET | Return TOTP secret + otpauth URI for Security Kit PDF |
| `/api/settings/hash-password` | POST | Generate Argon2id hash from settings UI |
| `/api/audit` | GET | Sign-in audit log |
| `/api/favicon` | GET | Favicon proxy (browser never contacts Google) |

### Frontend

- `src/app/page.tsx` — main dashboard
- `src/app/login/page.tsx` — login (password + Secret Key + TOTP)
- `src/app/settings/page.tsx` — settings (Security Kit PDF, Secret Key, 2FA, Emergency Kit, key generation, audit log)
- `src/components/CopyButton.tsx` — two variants: `"icon"` (clipboard→check) and `"button"` (text)
- `src/components/PasswordList.tsx`, `PasswordForm.tsx`, `SearchBar.tsx`, `QrScanner.tsx`

### Electron wrapper

`electron/main.js` launches the Next.js app in an Electron window. Run `npm run dev` first, then `npm run app`.

---

## Rules for Claude

### Security invariants — never break these
- All crypto uses Node.js built-in `crypto` module (not CryptoJS — that is legacy-decrypt only).
- `VAULT_TOKEN`, `NEXTAUTH_SECRET`, `ENCRYPTION_KEY`, `MASTER_PASSWORD_HASH` must never appear in client-side code or be sent in API responses.
- The `twoFactorCode` field stores a **TOTP seed** (base32 secret), not a generated code. Treat as a secret.
- SK hash includes the `SK-` prefix — `hashSecretKey("SK-XXXXX-...", secret)`. Breaking this locks users out.
- Rate limiting is in-memory, single-instance only. Do not add distributed state without discussion.

### Vault operations
- Always use `deleteVaultPassword` (metadata DELETE) for hard deletion — the data endpoint only soft-deletes.
- `vaultRequest` throws on non-2xx. Callers must catch and handle 404 explicitly.
- Do not add any local database or file-based persistence. Vault is the only store.

### Emergency recovery
```bash
node scripts/reset-sk.mjs        # Disable Secret Key via Vault API (reads .env.local automatically)
node scripts/hash-password.mjs   # Generate Argon2id hash for new master password
```

### Import/export flow
Export: client sends entries to `/api/encrypt` → downloads as `.json`. Import: client uploads → decrypts via `/api/passwords/decrypt` if needed → `/api/passwords/import` (add-then-delete, not atomic). Replace-all semantics are intentional.

### TOTP display
`totpCodes[id]` in `PasswordList` is formatted as `"123456 (23s)"`. When copying, extract only the 6-digit token (before the space).

### Known issues — do not accidentally fix in unrelated PRs
- `postcss.config.js` / `postcss.config.mjs` and `tailwind.config.js` / `tailwind.config.ts` duplicates exist — do not create more config files.
- `.env_backup` contains old leaked keys — do not read it for actual config values.
