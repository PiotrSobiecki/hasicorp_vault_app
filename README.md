# 🔐 Vault Manager

> Elegancki, bezpieczny menedżer haseł zbudowany na bazie **HashiCorp Vault** jako backend przechowywania danych.  
> Aplikacja jest lekkim interfejsem webowym — wszystkie hasła żyją wyłącznie w Vault, nigdzie lokalnie.

---

## ✨ Funkcje

- 🔑 **Logowanie hasłem głównym** z podpisaną sesją HMAC-SHA256
- 🏦 **Pełna integracja z HashiCorp Vault KV v2** — dodawanie, edycja, usuwanie wpisów
- 🌐 **Favicon serwisów** — automatyczne pobieranie ikon z domeny wpisu
- 🔒 **Generowanie haseł** kryptograficznie bezpiecznym `crypto.getRandomValues()`
- ⏱️ **Obsługa TOTP / 2FA** — live odliczanie kodu i kopiowanie jednym kliknięciem
- 📤 **Eksport / Import** — zaszyfrowany plik JSON (AES-256-GCM)
- 🛡️ **Rate limiting** logowania (10 prób / 15 min per IP)
- 🔎 **Wyszukiwanie** wpisów w czasie rzeczywistym
- 🎨 **Ciemny motyw** inspirowany 1Password

---

## 🗂️ Stack

| Warstwa | Technologia |
|---|---|
| Framework | Next.js 15 (App Router) |
| Język | TypeScript |
| UI | Chakra UI + Tailwind CSS + Heroicons |
| Backend / storage | HashiCorp Vault KV v2 |
| Szyfrowanie eksportu | AES-256-GCM (Node.js `crypto`) |
| Sesja | HMAC-SHA256 podpisany token w httpOnly cookie |

---

## ⚙️ Konfiguracja środowiska

Skopiuj `.env.example` i uzupełnij wartości:

```bash
cp .env.example .env
```

| Zmienna | Opis |
|---|---|
| `MASTER_PASSWORD` | Hasło główne do odblokowywania aplikacji |
| `NEXTAUTH_SECRET` | Sekret do podpisywania tokenów sesji (min. 32 znaki) |
| `ENCRYPTION_KEY` | Klucz szyfrowania eksportowanych plików |
| `VAULT_ADDR` | Adres serwera HashiCorp Vault (np. `https://vault.example.com`) |
| `VAULT_TOKEN` | Token dostępu do Vault (zalecany: policy z dostępem tylko do `secret/credentials/*`) |
| `MOUNT_NAME` | Nazwa mount point w Vault (domyślnie `secret`) |
| `VAULT_PASSWORDS_PATH` | Ścieżka wewnątrz mount point (domyślnie `credentials`) |

> ⚠️ **Nigdy nie commituj pliku `.env` do repozytorium.** Upewnij się, że jest w `.gitignore`.

---

## 🚀 Uruchomienie lokalne

```bash
# Zainstaluj zależności
npm install

# Uruchom serwer deweloperski
npm run dev
```

Otwórz [http://localhost:3000](http://localhost:3000) i zaloguj się hasłem głównym.

---

## 🏗️ Struktura projektu

```
src/
├── app/
│   ├── api/
│   │   ├── login/          # Logowanie + HMAC sesja + rate limiting
│   │   ├── logout/         # Wylogowanie
│   │   ├── passwords/
│   │   │   ├── route.ts    # GET lista / POST nowy wpis
│   │   │   ├── [id]/       # GET / PUT / DELETE konkretny wpis
│   │   │   ├── import/     # Import haseł do Vault (atomowy)
│   │   │   └── decrypt/    # Server-side deszyfrowanie pliku importu
│   │   └── encrypt/        # Szyfrowanie eksportu
│   ├── login/              # Strona logowania
│   └── page.tsx            # Główny widok
├── components/
│   ├── PasswordList.tsx    # Lista wpisów z faviconami i TOTP
│   ├── PasswordForm.tsx    # Formularz dodawania / edycji
│   └── SearchBar.tsx       # Wyszukiwarka
└── lib/
    ├── vault.ts            # Klient HashiCorp Vault KV v2
    ├── encryption.ts       # AES-256-GCM encrypt/decrypt
    ├── rateLimit.ts        # In-memory rate limiter
    └── validation.ts       # Walidacja danych wejściowych
middleware.ts               # Ochrona tras — weryfikacja HMAC sesji
```

---

## 🔐 Model bezpieczeństwa

| Mechanizm | Implementacja |
|---|---|
| Sesja | Losowy 32-bajtowy token podpisany HMAC-SHA256 (`NEXTAUTH_SECRET`), httpOnly + SameSite=Strict |
| Weryfikacja sesji | Middleware Edge Runtime — stałoczasowe porównanie podpisów |
| Hasło główne | Porównanie `crypto.timingSafeEqual` + stałe opóźnienie 200ms przy błędzie |
| Rate limiting | 10 prób na IP w oknie 15 minut → HTTP 429 |
| Szyfrowanie eksportu | AES-256-GCM z losowym IV per operację + weryfikacja AuthTag |
| Klucz szyfrowania | Wyłącznie server-side — `ENCRYPTION_KEY` nigdy nie trafia do przeglądarki |
| Generowanie haseł | `crypto.getRandomValues()` (CSPRNG) |
| Transport | HTTPS (wymuszone w produkcji) |

---

## 📦 Struktura wpisu w Vault

Każde hasło przechowywane jest pod ścieżką:

```
<MOUNT_NAME>/data/<VAULT_PASSWORDS_PATH>/<uuid>
```

W sekcji `data` klucz-wartość:

```json
{
  "id": "uuid",
  "title": "GitHub",
  "username": "jan.kowalski@example.com",
  "password": "supersecret",
  "url": "https://github.com",
  "key": "opcjonalny dodatkowy klucz",
  "notes": "notatki",
  "twoFactorCode": "SEED_TOTP_BASE32"
}
```

---

## 🔄 Eksport i Import

### Eksport

Kliknij **Eksportuj** → aplikacja pobiera wszystkie hasła z Vault, szyfruje je AES-256-GCM i zapisuje jako plik `vault-backup-YYYY-MM-DD.json`.

### Import

Kliknij **Importuj** i wybierz plik `.json` (zaszyfrowany lub plain JSON):

1. Aplikacja dodaje **najpierw nowe wpisy** do Vault
2. Dopiero po sukcesie usuwa stare

Dzięki odwróconej kolejności import jest **atomowy** — przy błędzie stare dane nie są tracone.

---

## 🚢 Deploy (Railway)

1. Utwórz nowy projekt w [Railway](https://railway.app)
2. Dodaj zmienne środowiskowe z sekcji **Konfiguracja** powyżej
3. Ustaw `NODE_ENV=production`
4. Deploy z brancha `main`

```bash
# Build command (ustawiany automatycznie przez Railway)
npm run build

# Start command
npm start
```

---

## 📝 Licencja

Projekt prywatny — użytek własny.
