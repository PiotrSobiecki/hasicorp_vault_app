# Vault Manager

Personal password manager backed by **HashiCorp Vault** as the sole storage backend. The app is a lightweight web (Next.js) or desktop (Electron) interface — all passwords live exclusively in Vault, never locally.

---

## Features

- Master password login with HMAC-SHA256 signed session cookie
- Full HashiCorp Vault KV v2 integration — add, edit, delete entries
- **Secret Key** — second login factor, required on any new device (like 1Password)
- **Two-Factor Authentication (TOTP)** — configurable from Settings, QR code setup
- **Security Kit PDF** — downloadable personal sign-in document with Secret Key + 2FA QR
- **Emergency Kit PDF** — Vault infrastructure keys for disaster recovery
- Service favicon fetched via server-side proxy (browser never contacts Google directly)
- Password generator — cryptographically secure (`crypto.getRandomValues()`, no modulo bias)
- TOTP / 2FA entry support — live countdown and one-click copy
- Export / Import — encrypted JSON file (AES-256-GCM)
- Login rate limiting (10 attempts / 15 min per IP)
- Next.js middleware protects all `/api/*` — no session = HTTP 401
- Sign-in audit log in Settings

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| UI | Chakra UI + Tailwind CSS + Heroicons |
| Backend / storage | HashiCorp Vault KV v2 |
| Export encryption | AES-256-GCM (Node.js `crypto`) |
| Session | HMAC-SHA256 signed token in HttpOnly cookie |

---

## 1. Setting up HashiCorp Vault

Vault is an open-source secrets store. You must run it yourself — the app does not use HashiCorp Cloud.

### Option A — Docker dev (fastest start)

```bash
docker run -d \
  --name vault \
  --cap-add=IPC_LOCK \
  -p 8200:8200 \
  -e VAULT_DEV_ROOT_TOKEN_ID=dev-only-token \
  hashicorp/vault:latest
```

> `dev` mode requires no unseal and keeps data in RAM. Data is lost on container restart. **Do not use in production.**

### Option B — Vault with persistent storage (production)

```bash
# 1. Install Vault: https://developer.hashicorp.com/vault/install

# 2. Create vault.hcl:
cat > vault.hcl <<'EOF'
storage "file" {
  path = "./vault-data"
}
listener "tcp" {
  address     = "127.0.0.1:8200"
  tls_disable = true   # local only; use TLS cert on a VPS
}
api_addr = "http://127.0.0.1:8200"
EOF

# 3. Start
vault server -config=vault.hcl

# 4. Initialize (once only — save the output offline!)
export VAULT_ADDR=http://127.0.0.1:8200
vault operator init
# Vault prints 5 unseal keys and 1 root token — store them in your Emergency Kit.

# 5. Unseal — requires 3 of 5 keys (after every restart)
vault operator unseal <key-1>
vault operator unseal <key-2>
vault operator unseal <key-3>
```

### Option C — Railway / Fly.io / VPS

Deploy Vault on any VPS. Remember:
- HTTPS (reverse proxy: nginx or Caddy)
- Persistent volume for storage
- Store unseal keys offline, not on the same server

```
# Caddy — automatic TLS (Caddyfile)
vault.example.com {
  reverse_proxy 127.0.0.1:8200
}
```

### KV v2 and access token setup

```bash
export VAULT_ADDR=http://127.0.0.1:8200
export VAULT_TOKEN=<root-token>   # only for initial setup

# Enable KV v2
vault secrets enable -path=secret kv-v2

# Create a minimal-access policy for the app
vault policy write vault-manager - <<'EOF'
path "secret/data/passwords/*" {
  capabilities = ["create", "read", "update", "delete"]
}
path "secret/metadata/passwords/*" {
  capabilities = ["list", "delete"]
}
path "secret/data/app/config" {
  capabilities = ["create", "read", "update"]
}
EOF

# Generate a scoped token (keep root token offline)
vault token create -policy=vault-manager -ttl=0 -period=0
# Save the generated token as VAULT_TOKEN in .env.local
```

---

## 2. Application configuration

Create `.env.local` in the project root:

```env
# HashiCorp Vault
VAULT_ADDR=http://127.0.0.1:8200
VAULT_TOKEN=hvs.XXXXXXXXXXXXXXXXXXXX
VAULT_MOUNT_NAME=secret
VAULT_PASSWORDS_PATH=passwords

# Session signing key (min. 32 random chars)
NEXTAUTH_SECRET=

# Export encryption key (min. 32 random chars)
ENCRYPTION_KEY=

# Master password — DEV only (plaintext, NODE_ENV != production)
# Wrap in double quotes if it contains special characters
MASTER_PASSWORD="your-password"

# Master password — PRODUCTION (Argon2id hash, see below)
# Use single quotes to prevent $ expansion by the env parser
# MASTER_PASSWORD_HASH='$argon2id$v=19$...'
```

> **Important:** Argon2id hashes start with `$argon2id$` which contains `$` signs. In `.env.local`, wrap the value in **single quotes** (`'`) to prevent the parser from treating `$argon2id` as a variable name.

### Generating keys and password hash

All three can be generated directly from the **Settings page** in the app (requires being logged in):

- **NEXTAUTH_SECRET** — Settings → Emergency Kit → Application → Generate button
- **ENCRYPTION_KEY** — same section
- **MASTER_PASSWORD_HASH** — same section, enter password + confirm → Hash

Or via CLI:

```bash
# NEXTAUTH_SECRET / ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# MASTER_PASSWORD_HASH
node scripts/hash-password.mjs
```

---

## 3. Running

```bash
npm install
npm run dev          # http://localhost:3333
```

Production build:

```bash
npm run build
npm start
```

Electron (desktop):

```bash
# Terminal 1
npm run dev

# Terminal 2
npm run app
```

---

## 4. Settings page

Access via the ⚙ icon in the top-right corner of the main dashboard.

### Security Kit PDF

A personal sign-in document — like 1Password's Emergency Kit. Download and store offline.

Contains:
- Account identifier / email
- Application URL
- **Secret Key** (if enabled) — required on new devices
- **2FA QR code** (if enabled) — scannable directly from the PDF
- TOTP manual entry secret
- Step-by-step sign-in instructions

### Secret Key

A second factor required on any new or unrecognized device, alongside the master password. Once entered on a device, it is stored in `localStorage` — you only need to type it once per device.

**Enable flow:**
1. Settings → Secret Key → **Enable Secret Key**
2. The key (`SK-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX`) is shown **once only**
3. Copy it and save it in your Security Kit PDF
4. Check "I have saved my Secret Key" → **Confirm & Enable**

**Rotate or disable** from the same section at any time.

**Emergency reset** (if locked out):
```bash
node scripts/reset-sk.mjs
# Reads VAULT_ADDR and VAULT_TOKEN from .env.local automatically
```

### Two-Factor Authentication (TOTP)

**Enable flow:**
1. Settings → Two-Factor Authentication → **Enable 2FA**
2. Scan the QR code with Google Authenticator, Authy, or any RFC 6238 app
3. Enter the 6-digit code to confirm → **Activate 2FA**

**Disable:** enter the current 6-digit code → Disable 2FA.

The TOTP secret is stored in Vault at `secret/data/app/config`.

### Emergency Kit PDF (HashiCorp Vault)

Infrastructure keys for disaster recovery. Fill in and download as PDF — store offline.

Contains: Vault URL, VAULT_TOKEN, 5 unseal keys, NEXTAUTH_SECRET, ENCRYPTION_KEY, MASTER_PASSWORD_HASH.

### Sign-in History

In-memory audit log of login attempts (success / failure / IP / timestamp). Resets on server restart.

---

## 5. Security model

| Mechanism | Implementation |
|---|---|
| Master password | Argon2id (prod) or constant-time plaintext compare (dev) |
| Secret Key | HMAC-SHA256(SK, NEXTAUTH_SECRET) stored in Vault — key never stored server-side |
| Session | Random 32-byte token signed HMAC-SHA256, HttpOnly + SameSite=Strict, 8h TTL |
| Session verification | Edge Runtime middleware — constant-time signature comparison |
| 2FA | TOTP (RFC 6238), secret stored in Vault, verified after password |
| Rate limiting | 10 attempts / 15 min per IP → HTTP 429 |
| Error delay | 300–500 ms random (prevents timing attacks and user enumeration) |
| Export encryption | AES-256-GCM with random 96-bit IV per operation + AuthTag verification |
| Encryption key | Server-side only — `ENCRYPTION_KEY` never sent to the browser |
| Password generator | `crypto.getRandomValues()` + rejection sampling (no modulo bias) |
| Favicon | Server proxy `/api/favicon` — browser never contacts Google |
| Transport | HTTPS enforced via `secure: true` on cookie in `NODE_ENV=production` |

---

## 6. Export and Import (backup)

Export creates an encrypted `vault-backup-YYYY-MM-DD.json` file (AES-256-GCM). Safe to store in cloud storage (Dropbox, Google Drive, etc.) as a backup.

Import replaces all entries in Vault — adds new ones first, then deletes old ones (safe ordering prevents data loss on error).

---

## 7. Emergency recovery

If locked out (e.g. lost Secret Key or 2FA device):

```bash
# Disable Secret Key requirement
node scripts/reset-sk.mjs

# Reset master password hash
node scripts/hash-password.mjs
# Then update MASTER_PASSWORD_HASH in .env.local and restart
```

To manually clear settings in Vault directly:
```bash
curl -s \
  -H "X-Vault-Token: YOUR_VAULT_TOKEN" \
  -H "Content-Type: application/merge-patch+json" \
  -X PATCH YOUR_VAULT_ADDR/v1/secret/data/app/config \
  -d '{"data":{"secretKeyEnabled":"false","secretKeyHash":"","totpEnabled":"false","totpSecret":""}}'
```

---

## 8. Roadmap

- [x] Secret Key — UI-configurable from Settings, localStorage for trusted devices, Security Kit PDF
- [x] Two-Factor Authentication (TOTP) — QR code setup in Settings, embedded in Security Kit PDF
- [x] Security Kit PDF — personal sign-in document with Secret Key + 2FA QR
- [x] Emergency Kit PDF — Vault infrastructure keys
- [x] Key generator in Settings — NEXTAUTH_SECRET, ENCRYPTION_KEY, MASTER_PASSWORD_HASH
- [x] TOTP seed import from QR — camera icon in entry form
- [x] Sign-in audit log — available in Settings
- [x] Copy buttons with visual feedback — checkmark animation on all copy actions
- [ ] Vault auto-unseal — AWS KMS / Azure Key Vault integration

---

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── login/              # Login + Argon2id + rate limiting
│   │   ├── logout/             # Logout
│   │   ├── login-config/       # Public: which factors are required
│   │   ├── favicon/            # Favicon proxy (no domain leak to Google)
│   │   ├── audit/              # Sign-in history
│   │   ├── settings/
│   │   │   ├── totp/           # TOTP enable/disable/verify
│   │   │   ├── totp/secret/    # Retrieve TOTP secret for Security Kit PDF
│   │   │   ├── secret-key/     # Secret Key enable/rotate/disable
│   │   │   └── hash-password/  # Generate Argon2id hash from Settings UI
│   │   ├── passwords/
│   │   │   ├── route.ts        # GET list / POST new entry
│   │   │   ├── [id]/           # GET / PUT / DELETE single entry
│   │   │   ├── import/         # Import entries to Vault
│   │   │   └── decrypt/        # Server-side import decryption
│   │   └── encrypt/            # Export encryption
│   ├── login/                  # Login page (master password + Secret Key + TOTP)
│   ├── settings/               # Settings page
│   └── page.tsx                # Main dashboard
├── components/
│   ├── PasswordList.tsx        # Entry list with favicons and TOTP
│   ├── PasswordForm.tsx        # Add / edit form with QR scanner
│   ├── QrScanner.tsx           # Camera-based QR code scanner
│   ├── CopyButton.tsx          # Copy button with visual feedback
│   └── SearchBar.tsx           # Client-side search filter
├── lib/
│   ├── vault.ts                # HashiCorp Vault KV v2 client
│   ├── encryption.ts           # AES-256-GCM encrypt/decrypt
│   ├── secretKey.ts            # Secret Key generation and verification
│   ├── rateLimit.ts            # In-memory rate limiter
│   └── auditLog.ts             # In-memory sign-in audit log
├── middleware.ts                # Route protection — HMAC session verification
scripts/
├── hash-password.mjs           # Generate Argon2id hash for master password
├── reset-sk.mjs                # Emergency: disable Secret Key via Vault API
└── setup.mjs                   # Initial setup wizard (legacy)
```
