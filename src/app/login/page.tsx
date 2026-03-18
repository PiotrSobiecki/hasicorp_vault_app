"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Nieprawidłowe hasło.");
      router.push(from || "/");
    } catch (err: any) {
      setError(err.message || "Błąd logowania.");
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
        <div className="pm-login-subtitle">Podaj hasło główne, aby odblokować sejf</div>
      </div>

      {/* Card */}
      <div className="pm-login-card">
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label className="pm-form-label">Hasło główne</label>
            <input
              type="password"
              className="pm-form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Wpisz hasło główne…"
              required
              autoFocus
            />
          </div>

          {error && <div className="pm-login-error">{error}</div>}

          <button type="submit" disabled={loading} className="pm-btn-primary" style={{ width: "100%", justifyContent: "center", padding: "12px 16px", fontSize: 14 }}>
            {loading ? (
              <>
                <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                Weryfikowanie…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                Odblokuj sejf
              </>
            )}
          </button>
        </form>
      </div>

      <p className="pm-login-hint" style={{ marginTop: 20 }}>
        Hasło jest weryfikowane wyłącznie po stronie serwera i nie jest zapamiętywane.<br />
        Dane trzymane są w <strong style={{ color: "var(--text-secondary)" }}>HashiCorp Vault</strong>.
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
