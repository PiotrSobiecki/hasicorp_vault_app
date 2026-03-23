"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyIcon, ShieldCheckIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

const SK_STORAGE_KEY = "pm_secret_key";

interface LoginConfig {
  totpRequired: boolean;
  secretKeyRequired: boolean;
  deviceTrusted: boolean;
}

export default function LoginPage() {
  const [config, setConfig] = useState<LoginConfig>({ totpRequired: false, secretKeyRequired: false, deviceTrusted: false });
  const [password, setPassword] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);
  const [rememberTotp, setRememberTotp] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [skStored, setSkStored] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawFrom = searchParams.get("from") || "/";
  const from = rawFrom.startsWith("/") && !rawFrom.includes("://") ? rawFrom : "/";
  const isReauth = searchParams.get("reauth") === "1";

  // TOTP is needed when required by config and device is not already trusted
  const showTotp = config.totpRequired && !config.deviceTrusted;

  // Fetch login config (which factors are required)
  useEffect(() => {
    fetch("/api/login-config")
      .then((r) => r.json())
      .then((data: LoginConfig) => {
        setConfig(data);
        // Load stored Secret Key for trusted devices
        if (data.secretKeyRequired) {
          const stored = localStorage.getItem(SK_STORAGE_KEY);
          if (stored) { setSecretKey(stored); setSkStored(true); }
        }
      })
      .catch(() => {});
  }, [isReauth]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, string | boolean> = { password };
      if (config.secretKeyRequired && secretKey) body.secretKey = secretKey;
      if (showTotp && totpCode) body.totpCode = totpCode;
      if (showTotp) body.rememberDevice = rememberTotp;

      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Invalid credentials.");

      if (config.secretKeyRequired && secretKey && rememberDevice) {
        localStorage.setItem(SK_STORAGE_KEY, secretKey);
      } else if (config.secretKeyRequired && !rememberDevice) {
        localStorage.removeItem(SK_STORAGE_KEY);
      }

      router.push(from || "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login error.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pm-login-wrap">
      {/* Brand */}
      <div className="pm-login-brand">
        <div className="pm-login-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div className="pm-login-title">Vault Manager</div>
        <div className="pm-login-subtitle">
          {isReauth
            ? "Re-enter your master password to continue"
            : "Enter your master password to unlock the vault"}
        </div>
      </div>

      {/* Card */}
      <div className="pm-login-card">
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Master password */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label className="pm-form-label">Master password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                className="pm-form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter master password…"
                required
                autoFocus
                style={{ paddingRight: 36, width: "100%" }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex" }}
              >
                {showPassword
                  ? <EyeSlashIcon style={{ width: 16, height: 16 }} />
                  : <EyeIcon style={{ width: 16, height: 16 }} />}
              </button>
            </div>
          </div>

          {/* Secret Key */}
          {config.secretKeyRequired && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="pm-form-label" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <KeyIcon style={{ width: 12, height: 12 }} />
                Secret Key
              </label>
              {skStored ? (
                <div className="pm-sk-stored">
                  <ShieldCheckIcon style={{ width: 14, height: 14, color: "var(--success)", flexShrink: 0 }} />
                  <span>Trusted device — Secret Key remembered</span>
                  <button type="button" className="pm-sk-forget" onClick={() => {
                    localStorage.removeItem(SK_STORAGE_KEY);
                    setSecretKey(""); setSkStored(false);
                  }}>Forget</button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    className="pm-form-input"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value.toUpperCase().replace(/[^A-Z2-7-]/g, ""))}
                    placeholder="SK-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                    required
                    spellCheck={false}
                    autoComplete="off"
                    style={{ fontFamily: "monospace", letterSpacing: "0.05em" }}
                  />
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "var(--text-muted)" }}>
                    <input type="checkbox" checked={rememberDevice} onChange={(e) => setRememberDevice(e.target.checked)}
                      style={{ accentColor: "var(--accent)", width: 13, height: 13 }} />
                    Remember on this device
                  </label>
                </>
              )}
            </div>
          )}

          {/* TOTP */}
          {showTotp && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="pm-form-label" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                2FA code
              </label>
              <input
                type="text"
                inputMode="numeric"
                className="pm-form-input"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                required
                autoComplete="one-time-code"
                style={{ fontFamily: "monospace", fontSize: 20, letterSpacing: "0.25em", textAlign: "center" }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "var(--text-muted)" }}>
                <input type="checkbox" checked={rememberTotp} onChange={(e) => setRememberTotp(e.target.checked)}
                  style={{ accentColor: "var(--accent)", width: 13, height: 13 }} />
                Don&apos;t ask for 2FA on this device for 30 days
              </label>
            </div>
          )}

          {error && <div className="pm-login-error">{error}</div>}

          <button type="submit" disabled={loading} className="pm-btn-primary"
            style={{ width: "100%", justifyContent: "center", padding: "12px 16px", fontSize: 14 }}>
            {loading ? (
              <>
                <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                Verifying…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Unlock vault
              </>
            )}
          </button>
        </form>
      </div>

      <p className="pm-login-hint" style={{ marginTop: 20 }}>
        Password verified server-side only.<br />
        Data stored in <strong style={{ color: "var(--text-secondary)" }}>HashiCorp Vault</strong>.
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
