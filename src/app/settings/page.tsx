"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import QRCode from "qrcode";
import CopyButton from "@/components/CopyButton";
import { jsPDF } from "jspdf";
import {
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  ShieldExclamationIcon,
  ShieldCheckIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  KeyIcon,
  ArrowPathIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";
import { AuditEvent } from "@/lib/auditLog";

const SK_STORAGE_KEY = "pm_secret_key";

// ── Helpers ───────────────────────────────────────────────────
function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

// ── Emergency Kit field ───────────────────────────────────────
function KitField({ label, value, onChange, placeholder, mono = false }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div className="pm-form-group">
      <label className="pm-form-label">{label}</label>
      <input
        className="pm-form-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={mono ? { fontFamily: "monospace", fontSize: 12, letterSpacing: "0.03em" } : undefined}
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}

type TotpUiState = "idle" | "scanning";
type SkUiState = "idle" | "generated" | "disabling";

export default function SettingsPage() {
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);
  const [kit, setKit] = useState({
    vaultUrl: "",
    vaultToken: "",
    unseal1: "", unseal2: "", unseal3: "", unseal4: "", unseal5: "",
    nextauthSecret: "", encryptionKey: "", masterPasswordHash: "",
  });
  const setK = (field: keyof typeof kit) => (v: string) =>
    setKit((prev) => ({ ...prev, [field]: v }));

  // TOTP state
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpUiState, setTotpUiState] = useState<TotpUiState>("idle");
  const [totpSecret, setTotpSecret] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [totpDisableCode, setTotpDisableCode] = useState("");
  const [totpError, setTotpError] = useState<string | null>(null);
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpDisabling, setTotpDisabling] = useState(false);
  const totpInputRef = useRef<HTMLInputElement>(null);

  // Secret Key state
  const [skEnabled, setSkEnabled] = useState(false);
  const [skUiState, setSkUiState] = useState<SkUiState>("idle");
  const [newSK, setNewSK] = useState(""); // shown once after generation
  const [skSaved, setSkSaved] = useState(false);
  const [skLoading, setSkLoading] = useState(false);
  const [skError, setSkError] = useState<string | null>(null);
  const [skDisableConfirm, setSkDisableConfirm] = useState(false);
  const storedSK = typeof window !== "undefined" ? localStorage.getItem(SK_STORAGE_KEY) ?? "" : "";

  // Security Kit PDF inputs
  const [skitAccount, setSkitAccount] = useState("");
  const [skitAppUrl, setSkitAppUrl] = useState("");

  // Key generation
  const [hashPwInput, setHashPwInput] = useState("");
  const [hashPwConfirm, setHashPwConfirm] = useState("");
  const [hashPwVisible, setHashPwVisible] = useState(false);
  const [hashPwLoading, setHashPwLoading] = useState(false);
  const [hashPwError, setHashPwError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/audit").then((r) => r.json()).then(setAuditLog).catch(() => {});
    fetch("/api/settings/totp").then((r) => r.json()).then((d) => setTotpEnabled(d.enabled === true)).catch(() => {});
    fetch("/api/settings/secret-key").then((r) => r.json()).then((d) => setSkEnabled(d.enabled === true)).catch(() => {});
  }, []);

  // ── TOTP ──────────────────────────────────────────────────────
  async function handleGenerateTotp() {
    setTotpError(null);
    setTotpLoading(true);
    try {
      const res = await fetch("/api/settings/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error generating TOTP.");
      setTotpSecret(data.secret);
      setTotpUri(data.otpauthUri);
      setTotpUiState("scanning");
      setTimeout(() => totpInputRef.current?.focus(), 100);
    } catch (e) {
      setTotpError(e instanceof Error ? e.message : "Error.");
    } finally {
      setTotpLoading(false);
    }
  }

  async function handleVerifyTotp() {
    if (totpCode.length !== 6) return;
    setTotpError(null);
    setTotpLoading(true);
    try {
      const res = await fetch("/api/settings/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", secret: totpSecret, code: totpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid code.");
      setTotpEnabled(true);
      setTotpUiState("idle");
      setTotpSecret(""); setTotpUri(""); setTotpCode("");
    } catch (e) {
      setTotpError(e instanceof Error ? e.message : "Error.");
    } finally {
      setTotpLoading(false);
    }
  }

  async function handleDisableTotp() {
    if (!totpDisableCode) return;
    setTotpError(null);
    setTotpDisabling(true);
    try {
      const res = await fetch("/api/settings/totp", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpDisableCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid code.");
      setTotpEnabled(false);
      setTotpDisableCode(""); setTotpError(null);
    } catch (e) {
      setTotpError(e instanceof Error ? e.message : "Error.");
    } finally {
      setTotpDisabling(false);
    }
  }

  // ── Secret Key ────────────────────────────────────────────────
  async function handleGenerateSK() {
    setSkError(null);
    setSkLoading(true);
    try {
      const res = await fetch("/api/settings/secret-key", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error generating Secret Key.");
      setNewSK(data.secretKey);
      setSkSaved(false);
      setSkUiState("generated");
    } catch (e) {
      setSkError(e instanceof Error ? e.message : "Error.");
    } finally {
      setSkLoading(false);
    }
  }

  function handleConfirmSKSaved() {
    // Store SK on this device (trusted device)
    if (typeof window !== "undefined") {
      localStorage.setItem(SK_STORAGE_KEY, newSK);
    }
    setSkEnabled(true);
    setSkUiState("idle");
    setNewSK("");
    setSkSaved(false);
  }

  async function handleDisableSK() {
    setSkError(null);
    setSkLoading(true);
    try {
      const res = await fetch("/api/settings/secret-key", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error.");
      if (typeof window !== "undefined") localStorage.removeItem(SK_STORAGE_KEY);
      setSkEnabled(false);
      setSkDisableConfirm(false);
    } catch (e) {
      setSkError(e instanceof Error ? e.message : "Error.");
    } finally {
      setSkLoading(false);
    }
  }

  // ── Key generation helpers ────────────────────────────────────
  function generateRandomHex(bytes: number): string {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function handleHashPassword() {
    if (!hashPwInput) return;
    if (hashPwInput !== hashPwConfirm) {
      setHashPwError("Passwords do not match.");
      return;
    }
    setHashPwError(null);
    setHashPwLoading(true);
    try {
      const res = await fetch("/api/settings/hash-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: hashPwInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Hashing failed.");
      setKit((prev) => ({ ...prev, masterPasswordHash: data.hash }));
      setHashPwInput(""); setHashPwConfirm("");
    } catch (e) {
      setHashPwError(e instanceof Error ? e.message : "Error.");
    } finally {
      setHashPwLoading(false);
    }
  }

  // ── Security Kit PDF ──────────────────────────────────────────
  async function handleDownloadSecurityKit() {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const m = 20;
    const cW = W - m * 2;
    const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

    // Fetch TOTP secret if 2FA is enabled
    let totpSecret2 = "";
    let totpUri2 = "";
    let qrDataUrl = "";
    if (totpEnabled) {
      try {
        const r = await fetch("/api/settings/totp/secret");
        const d = await r.json();
        if (d.enabled) { totpSecret2 = d.secret; totpUri2 = d.otpauthUri; }
      } catch { /* skip */ }
      if (totpUri2) {
        try {
          qrDataUrl = await QRCode.toDataURL(totpUri2, {
            width: 160, margin: 1, color: { dark: "#000000", light: "#ffffff" },
          });
        } catch { /* skip */ }
      }
    }

    // Header band
    doc.setFillColor(26, 111, 255);
    doc.rect(0, 0, W, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text("Vault Manager", m, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text("Security Kit", m + 43, 11);
    doc.setFontSize(8);
    doc.text(date, W - m, 11, { align: "right" });

    let y = 28;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(20, 20, 40);
    doc.text("Your Security Kit", m, y);
    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 140);
    doc.text("Keep this document offline. You will need it to sign in from a new device.", m, y);
    y += 14;

    // Helpers
    const section = (title: string) => {
      doc.setFillColor(245, 247, 250);
      doc.rect(m, y, cW, 7, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 140);
      doc.text(title.toUpperCase(), m + 3, y + 4.8);
      y += 10;
    };

    const row = (label: string, value: string, large = false) => {
      if (!value) return;
      const rH = large ? 13 : 9;
      doc.setFillColor(252, 252, 254);
      doc.rect(m, y, cW, rH, "F");
      doc.setDrawColor(230, 230, 235);
      doc.rect(m, y, cW, rH, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(80, 80, 100);
      doc.text(label, m + 3, y + rH / 2 + 1);
      doc.setFont("courier", large ? "bold" : "normal");
      doc.setFontSize(large ? 9 : 7.5);
      doc.setTextColor(20, 20, 50);
      const lines = doc.splitTextToSize(value, cW - 55);
      doc.text(lines, m + 52, y + rH / 2 + 1);
      y += rH + 1;
    };

    // Account
    section("Account");
    row("Identifier / Email", skitAccount || "(not provided)");
    row("Application URL", skitAppUrl || "(not provided)");
    y += 4;

    // Secret Key
    if (skEnabled) {
      section("Secret Key");
      const sk = storedSK || "(not found on this device — re-generate from settings)";
      row("Secret Key", sk, sk.startsWith("SK-"));
      y += 3;
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(130, 130, 150);
      doc.text(
        "Required together with your master password on any new or unrecognized device.",
        m + 3, y,
      );
      y += 10;
    }

    // 2FA
    section("Two-Factor Authentication (2FA)");
    if (!totpEnabled) {
      row("2FA Status", "Disabled");
      y += 3;
    } else {
      row("2FA Status", "Enabled (TOTP)");
      y += 4;

      if (qrDataUrl) {
        // QR code + secret side by side
        const qrMm = 42;
        const qrY = y;
        doc.addImage(qrDataUrl, "PNG", m, qrY, qrMm, qrMm);

        const tx = m + qrMm + 6;
        const tW = cW - qrMm - 6;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(50, 50, 70);
        doc.text("Scan with your authenticator app", tx, y + 5);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 100, 120);
        doc.text("Google Authenticator, Authy, etc.", tx, y + 10);

        y += 14;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(80, 80, 100);
        doc.text("Manual entry secret:", tx, y);
        y += 5;

        // Chunk secret into groups of 4 for readability
        const chunks = totpSecret2.match(/.{1,4}/g) ?? [totpSecret2];
        doc.setFont("courier", "bold");
        doc.setFontSize(8);
        doc.setTextColor(20, 20, 50);
        const secretLines = doc.splitTextToSize(chunks.join(" "), tW);
        doc.text(secretLines, tx, y);
        y += secretLines.length * 4 + 4;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(130, 130, 150);
        doc.text("TOTP  SHA-1  6 digits  30 s", tx, y);

        // y must clear the bottom of the QR image
        y = Math.max(y + 6, qrY + qrMm + 4);
      }

      y += 4;
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(130, 130, 150);
      doc.text(
        "Backup: if you lose your phone, disable 2FA from settings using the code,\nor restore the TOTP secret from Vault (secret/data/app/config).",
        m + 3, y,
      );
      y += 12;
    }

    // Sign-in steps
    y += 4;
    section("How to Sign In");
    const steps = [
      "1. Open the application at the URL listed above.",
      skEnabled
        ? "2. Enter your master password and the Secret Key from this document."
        : "2. Enter your master password.",
      totpEnabled ? "3. Enter the 6-digit code from your authenticator app." : "",
    ].filter(Boolean);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(50, 50, 70);
    steps.forEach((step) => { doc.text(step, m + 3, y); y += 7; });

    // Warning
    y += 6;
    doc.setFillColor(255, 243, 220);
    doc.setDrawColor(245, 166, 35);
    doc.roundedRect(m, y, cW, 24, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(122, 87, 0);
    doc.text("IMPORTANT", m + 4, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(
      "This document contains everything needed to access your vault.\nStore it offline in a secure location. Never share it with anyone.\nIf compromised, rotate your Secret Key and master password immediately.",
      m + 4, y + 13,
    );

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.setFont("helvetica", "normal");
    doc.text("Vault Manager Security Kit", m, H - 8);
    doc.text(date, W - m, H - 8, { align: "right" });

    doc.save(`vault-security-kit-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  // ── Emergency Kit PDF ─────────────────────────────────────────
  function handleDownloadEmergencyKit() {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const H = doc.internal.pageSize.getHeight();
    const m = 20;
    const cW = W - m * 2;
    let y = 14;
    const date = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

    doc.setFillColor(26, 111, 255);
    doc.rect(0, 0, W, 14, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text("Vault Manager - Emergency Kit", m, 9.5);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(date, W - m, 9.5, { align: "right" });
    y = 24;

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text("Store offline, in a sealed envelope, away from the server.", m, y);
    y += 10;

    const section = (title: string) => {
      doc.setFillColor(245, 247, 250);
      doc.rect(m, y, cW, 6, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(120, 120, 140);
      doc.text(title.toUpperCase(), m + 3, y + 4);
      y += 8;
    };

    const fieldRow = (label: string, value: string) => {
      if (!value) return;
      doc.setFillColor(252, 252, 254);
      doc.rect(m, y, cW, 7, "F");
      doc.setDrawColor(230, 230, 235);
      doc.rect(m, y, cW, 7, "S");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(80, 80, 100);
      doc.text(label, m + 3, y + 4.5);
      doc.setFont("courier", "normal");
      doc.setFontSize(7);
      doc.setTextColor(30, 30, 50);
      const lines = doc.splitTextToSize(value, cW - 55);
      doc.text(lines, m + 52, y + 4.5);
      y += Math.max(7, lines.length * 4);
    };

    section("HashiCorp Vault");
    fieldRow("Vault URL", kit.vaultUrl);
    fieldRow("VAULT_TOKEN", kit.vaultToken);
    fieldRow("Unseal Key 1", kit.unseal1);
    fieldRow("Unseal Key 2", kit.unseal2);
    fieldRow("Unseal Key 3", kit.unseal3);
    fieldRow("Unseal Key 4", kit.unseal4);
    fieldRow("Unseal Key 5", kit.unseal5);
    y += 4;

    section("Application");
    fieldRow("NEXTAUTH_SECRET", kit.nextauthSecret);
    fieldRow("ENCRYPTION_KEY", kit.encryptionKey);
    fieldRow("MASTER_PASSWORD_HASH", kit.masterPasswordHash);
    y += 8;

    doc.setFillColor(255, 251, 240);
    doc.setDrawColor(245, 166, 35);
    doc.roundedRect(m, y, cW, 18, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(122, 87, 0);
    doc.text("WARNING", m + 4, y + 5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(
      "This document contains all keys required to recover access to the vault.\nCompromising any key requires immediate rotation.\nConsider splitting unseal keys between two physical locations.",
      m + 4, y + 9,
    );

    doc.setFontSize(7);
    doc.setTextColor(180, 180, 180);
    doc.setFont("helvetica", "normal");
    doc.text("Vault Manager - Emergency Kit", m, H - 8);
    doc.text(date, W - m, H - 8, { align: "right" });

    doc.save(`vault-emergency-kit-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <div className="pm-app">
      {/* Header */}
      <header className="pm-header">
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)", textDecoration: "none", fontSize: 13, fontWeight: 500 }}>
          <ArrowLeftIcon style={{ width: 16, height: 16 }} />
          Back
        </Link>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>Settings</div>
        <div style={{ width: 60 }} />
      </header>

      {/* ── Security Kit PDF ──────────────────────────────────── */}
      <div className="pm-card" style={{ marginBottom: 16 }}>
        <div className="pm-section-header">
          <span className="pm-section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ShieldCheckIcon style={{ width: 14, height: 14 }} />
            Security Kit
          </span>
          <button className="pm-btn-primary" onClick={handleDownloadSecurityKit}
            style={{ fontSize: 12, padding: "6px 12px" }}>
            <ArrowDownTrayIcon style={{ width: 13, height: 13 }} />
            Download PDF
          </button>
        </div>

        <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
            Your personal sign-in document — like 1Password&apos;s Emergency Kit.
            Contains your Secret Key and 2FA status needed on a new device.
            Store it offline or in a physical safe.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="pm-form-group">
              <label className="pm-form-label">Identifier / Email</label>
              <input className="pm-form-input" value={skitAccount}
                onChange={(e) => setSkitAccount(e.target.value)}
                placeholder="e.g. jan@example.com" autoComplete="off" />
            </div>
            <div className="pm-form-group">
              <label className="pm-form-label">Application URL</label>
              <input className="pm-form-input" value={skitAppUrl}
                onChange={(e) => setSkitAppUrl(e.target.value)}
                placeholder="https://vault.example.com" autoComplete="off" />
            </div>
          </div>
          <div style={{ background: "rgba(26,111,255,0.06)", border: "1px solid rgba(26,111,255,0.15)", borderRadius: "var(--r-sm)", padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            <strong>PDF includes:</strong> account info, application URL
            {skEnabled && ", Secret Key"}{totpEnabled && ", 2FA status"}, sign-in instructions.
          </div>
        </div>
      </div>

      {/* ── Secret Key ────────────────────────────────────────── */}
      <div className="pm-card" style={{ marginBottom: 16 }}>
        <div className="pm-section-header">
          <span className="pm-section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <KeyIcon style={{ width: 14, height: 14 }} />
            Secret Key
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600,
            color: skEnabled ? "var(--success)" : "var(--text-muted)" }}>
            {skEnabled
              ? <><CheckCircleIcon style={{ width: 13, height: 13 }} /> Enabled</>
              : <><XCircleIcon style={{ width: 13, height: 13 }} /> Disabled</>}
          </span>
        </div>

        <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Disabled, idle */}
          {!skEnabled && skUiState === "idle" && (
            <>
              <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
                Add a second factor to your sign-in, just like 1Password.
                A <strong style={{ color: "var(--text-secondary)" }}>Secret Key</strong> is generated once and stored in your Security Kit PDF.
                On any new or unrecognized device you must provide it alongside your master password.
                Devices you use regularly store it locally so you only type it once.
              </p>
              <div>
                <button className="pm-btn-primary" onClick={handleGenerateSK} disabled={skLoading}
                  style={{ fontSize: 13, padding: "8px 16px" }}>
                  {skLoading ? "Generating…" : "Enable Secret Key"}
                </button>
              </div>
              {skError && <div className="pm-login-error">{skError}</div>}
            </>
          )}

          {/* Generated — shown once */}
          {skUiState === "generated" && newSK && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ background: "rgba(26,111,255,0.06)", border: "2px solid var(--accent)", borderRadius: "var(--r-md)", padding: "16px 20px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  Your Secret Key — shown once only
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontFamily: "monospace", fontSize: 15, letterSpacing: "0.12em", color: "var(--text-primary)", fontWeight: 700, flex: 1, wordBreak: "break-all" }}>
                    {newSK}
                  </div>
                  <CopyButton text={newSK} style={{ flexShrink: 0 }} />
                </div>
              </div>

              <div style={{ background: "rgba(240,80,80,0.07)", border: "1px solid rgba(240,80,80,0.25)", borderRadius: "var(--r-sm)", padding: "10px 14px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                ⚠ <strong>Save this key now.</strong> It will never be shown again.
                Copy it to your Security Kit PDF (above) and store it offline.
                If lost, you will need to generate a new key and update your Security Kit.
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "var(--text-secondary)" }}>
                  <input type="checkbox" checked={skSaved} onChange={(e) => setSkSaved(e.target.checked)}
                    style={{ accentColor: "var(--accent)", width: 14, height: 14 }} />
                  I have saved my Secret Key in a safe place
                </label>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button className="pm-btn-primary" onClick={handleConfirmSKSaved} disabled={!skSaved}
                  style={{ fontSize: 13, padding: "8px 16px" }}>
                  Confirm &amp; Enable
                </button>
                <button className="pm-btn-secondary" onClick={async () => {
                  // Undo — disable since we already saved the hash
                  await fetch("/api/settings/secret-key", { method: "DELETE" });
                  setSkUiState("idle"); setNewSK(""); setSkSaved(false);
                }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Enabled, idle */}
          {skEnabled && skUiState === "idle" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ background: "rgba(0,200,120,0.07)", border: "1px solid rgba(0,200,120,0.2)", borderRadius: "var(--r-sm)", padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Secret Key is active. Any new device must provide it to sign in.
                {storedSK && (
                  <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
                    <ShieldCheckIcon style={{ width: 13, height: 13, color: "var(--success)" }} />
                    <span style={{ color: "var(--success)", fontWeight: 600 }}>This device is trusted</span>
                    <span style={{ color: "var(--text-muted)" }}>— key stored locally</span>
                    <CopyButton text={storedSK} label="Copy key" style={{ fontSize: 11, padding: "3px 8px" }} />
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="pm-btn-secondary" onClick={handleGenerateSK} disabled={skLoading}>
                  {skLoading ? "Generating…" : "Rotate Secret Key"}
                </button>
                {!skDisableConfirm
                  ? <button className="pm-btn-danger" onClick={() => setSkDisableConfirm(true)}>Disable Secret Key</button>
                  : <>
                    <button className="pm-btn-danger" onClick={handleDisableSK} disabled={skLoading}>
                      {skLoading ? "Disabling…" : "Confirm Disable"}
                    </button>
                    <button className="pm-btn-secondary" onClick={() => setSkDisableConfirm(false)}>Cancel</button>
                  </>
                }
              </div>
              {skError && <div className="pm-login-error">{skError}</div>}
            </div>
          )}
        </div>
      </div>

      {/* ── 2FA (TOTP) ───────────────────────────────────────── */}
      <div className="pm-card" style={{ marginBottom: 16 }}>
        <div className="pm-section-header">
          <span className="pm-section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            Two-Factor Authentication
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600,
            color: totpEnabled ? "var(--success)" : "var(--text-muted)" }}>
            {totpEnabled
              ? <><CheckCircleIcon style={{ width: 13, height: 13 }} /> Enabled</>
              : <><XCircleIcon style={{ width: 13, height: 13 }} /> Disabled</>}
          </span>
        </div>

        <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Enabled, idle */}
          {totpEnabled && totpUiState === "idle" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ background: "rgba(0,200,120,0.07)", border: "1px solid rgba(0,200,120,0.2)", borderRadius: "var(--r-sm)", padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                Two-factor authentication is active. A 6-digit code from your authenticator app
                is required at every sign-in.
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="text" inputMode="numeric" className="pm-form-input"
                  value={totpDisableCode}
                  onChange={(e) => setTotpDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Enter current 2FA code to disable"
                  style={{ fontFamily: "monospace", fontSize: 16, letterSpacing: "0.18em", textAlign: "center", width: 230 }}
                />
                <button className="pm-btn-danger" onClick={handleDisableTotp}
                  disabled={totpDisabling || totpDisableCode.length !== 6}>
                  {totpDisabling ? "Disabling…" : "Disable 2FA"}
                </button>
              </div>
              {totpError && <div className="pm-login-error">{totpError}</div>}
            </div>
          )}

          {/* Disabled, idle */}
          {!totpEnabled && totpUiState === "idle" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
                Enable time-based one-time passwords (TOTP). You will need an authenticator app
                on your phone: Google Authenticator, Authy, or any RFC 6238-compatible app.
              </p>
              <div>
                <button className="pm-btn-primary" onClick={handleGenerateTotp} disabled={totpLoading}
                  style={{ fontSize: 13, padding: "8px 16px" }}>
                  {totpLoading ? "Generating…" : "Enable 2FA"}
                </button>
              </div>
              {totpError && <div className="pm-login-error">{totpError}</div>}
            </div>
          )}

          {/* QR setup */}
          {totpUiState === "scanning" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div style={{ background: "#fff", padding: 12, borderRadius: "var(--r-md)", border: "2px solid var(--accent)", display: "inline-block" }}>
                    <QRCodeSVG value={totpUri} size={160} />
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Scan in your authenticator app</span>
                </div>

                <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      Or enter manually
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.08em", background: "var(--bg-secondary)", borderRadius: "var(--r-sm)", padding: "6px 10px", wordBreak: "break-all", color: "var(--text-primary)", border: "1px solid var(--border)" }}>
                      {totpSecret}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
                      TOTP &bull; SHA-1 &bull; 6 digits &bull; 30 s
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>
                      Enter the code from your app to confirm
                    </label>
                    <input
                      ref={totpInputRef}
                      type="text" inputMode="numeric" className="pm-form-input"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      autoComplete="one-time-code"
                      style={{ fontFamily: "monospace", fontSize: 22, letterSpacing: "0.3em", textAlign: "center" }}
                    />
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="pm-btn-primary" onClick={handleVerifyTotp}
                      disabled={totpLoading || totpCode.length !== 6}
                      style={{ fontSize: 13, padding: "8px 16px" }}>
                      {totpLoading ? "Verifying…" : "Activate 2FA"}
                    </button>
                    <button className="pm-btn-secondary" onClick={() => {
                      setTotpUiState("idle"); setTotpSecret(""); setTotpUri("");
                      setTotpCode(""); setTotpError(null);
                    }}>Cancel</button>
                  </div>
                  {totpError && <div className="pm-login-error">{totpError}</div>}
                </div>
              </div>

              <div style={{ background: "rgba(240,80,80,0.07)", border: "1px solid rgba(240,80,80,0.2)", borderRadius: "var(--r-sm)", padding: "10px 14px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                ⚠ Save the TOTP secret (<strong>{totpSecret.slice(0, 8)}&hellip;</strong>) in a safe place —
                you will need it to restore access if you lose your phone.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Emergency Kit ─────────────────────────────────────── */}
      <div className="pm-card" style={{ marginBottom: 16 }}>
        <div className="pm-section-header">
          <span className="pm-section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ShieldExclamationIcon style={{ width: 14, height: 14 }} />
            Emergency Kit — HashiCorp Vault
          </span>
          <button className="pm-btn-secondary" onClick={handleDownloadEmergencyKit}>
            <ArrowDownTrayIcon style={{ width: 13, height: 13 }} />
            Download PDF
          </button>
        </div>

        <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            Infrastructure keys — Vault unseal keys and tokens. Fill in and print; store offline.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
              HashiCorp Vault
            </div>
            <KitField label="Vault URL" value={kit.vaultUrl} onChange={setK("vaultUrl")} placeholder="https://vault.example.com" />
            <KitField label="VAULT_TOKEN" value={kit.vaultToken} onChange={setK("vaultToken")} placeholder="hvs.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" mono />
            <KitField label="Unseal Key 1" value={kit.unseal1} onChange={setK("unseal1")} mono />
            <KitField label="Unseal Key 2" value={kit.unseal2} onChange={setK("unseal2")} mono />
            <KitField label="Unseal Key 3" value={kit.unseal3} onChange={setK("unseal3")} mono />
            <KitField label="Unseal Key 4" value={kit.unseal4} onChange={setK("unseal4")} mono />
            <KitField label="Unseal Key 5" value={kit.unseal5} onChange={setK("unseal5")} mono />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
              Application
            </div>

            {/* NEXTAUTH_SECRET */}
            <div className="pm-form-group">
              <label className="pm-form-label">NEXTAUTH_SECRET</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input className="pm-form-input" value={kit.nextauthSecret}
                  onChange={(e) => setKit((p) => ({ ...p, nextauthSecret: e.target.value }))}
                  style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.03em", flex: 1 }}
                  autoComplete="off" spellCheck={false} />
                <button className="pm-btn-secondary" style={{ flexShrink: 0, fontSize: 11, padding: "5px 10px" }}
                  onClick={() => { const v = generateRandomHex(32); setKit((p) => ({ ...p, nextauthSecret: v })); }}>
                  <ArrowPathIcon style={{ width: 11, height: 11 }} /> Generate
                </button>
                {kit.nextauthSecret && (
                  <CopyButton text={kit.nextauthSecret} style={{ flexShrink: 0, fontSize: 11, padding: "5px 10px" }} />
                )}
              </div>
            </div>

            {/* ENCRYPTION_KEY */}
            <div className="pm-form-group">
              <label className="pm-form-label">ENCRYPTION_KEY</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input className="pm-form-input" value={kit.encryptionKey}
                  onChange={(e) => setKit((p) => ({ ...p, encryptionKey: e.target.value }))}
                  style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.03em", flex: 1 }}
                  autoComplete="off" spellCheck={false} />
                <button className="pm-btn-secondary" style={{ flexShrink: 0, fontSize: 11, padding: "5px 10px" }}
                  onClick={() => { const v = generateRandomHex(32); setKit((p) => ({ ...p, encryptionKey: v })); }}>
                  <ArrowPathIcon style={{ width: 11, height: 11 }} /> Generate
                </button>
                {kit.encryptionKey && (
                  <CopyButton text={kit.encryptionKey} style={{ flexShrink: 0, fontSize: 11, padding: "5px 10px" }} />
                )}
              </div>
            </div>

            {/* MASTER_PASSWORD_HASH */}
            <div className="pm-form-group">
              <label className="pm-form-label">MASTER_PASSWORD_HASH</label>
              {kit.masterPasswordHash ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <input className="pm-form-input" value={kit.masterPasswordHash}
                    onChange={(e) => setKit((p) => ({ ...p, masterPasswordHash: e.target.value }))}
                    style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.02em", flex: 1 }}
                    autoComplete="off" spellCheck={false} placeholder="$argon2id$v=19$..." />
                  <CopyButton text={kit.masterPasswordHash} style={{ flexShrink: 0, fontSize: 11, padding: "5px 10px" }} />
                  <button className="pm-btn-secondary" style={{ flexShrink: 0, fontSize: 11, padding: "5px 10px" }}
                    onClick={() => setKit((p) => ({ ...p, masterPasswordHash: "" }))}>
                    Clear
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "var(--r-sm)", padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Generate an Argon2id hash for your master password:
                    </div>
                    <button className="pm-btn-secondary" style={{ fontSize: 11, padding: "4px 10px" }}
                      onClick={() => {
                        const CHARSET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*-_=+";
                        const MAX = Math.floor(0x100000000 / CHARSET.length) * CHARSET.length;
                        const chars: string[] = [];
                        while (chars.length < 20) {
                          const n = new DataView(crypto.getRandomValues(new Uint8Array(4)).buffer).getUint32(0);
                          if (n < MAX) chars.push(CHARSET[n % CHARSET.length]);
                        }
                        const pw = chars.join("");
                        setHashPwInput(pw);
                        setHashPwConfirm(pw);
                        setHashPwVisible(true);
                        copyToClipboard(pw);
                      }}>
                      <ArrowPathIcon style={{ width: 11, height: 11 }} /> Generate password
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <div style={{ position: "relative", flex: 1 }}>
                      <input className="pm-form-input"
                        type={hashPwVisible ? "text" : "password"}
                        value={hashPwInput}
                        onChange={(e) => setHashPwInput(e.target.value)}
                        placeholder="Master password"
                        autoComplete="new-password"
                        style={{ paddingRight: 32, width: "100%" }} />
                      <button type="button"
                        style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}
                        onClick={() => setHashPwVisible((v) => !v)}>
                        {hashPwVisible ? <EyeSlashIcon style={{ width: 14, height: 14 }} /> : <EyeIcon style={{ width: 14, height: 14 }} />}
                      </button>
                    </div>
                    <input className="pm-form-input"
                      type={hashPwVisible ? "text" : "password"}
                      value={hashPwConfirm}
                      onChange={(e) => setHashPwConfirm(e.target.value)}
                      placeholder="Confirm password"
                      autoComplete="new-password"
                      style={{ flex: 1 }} />
                    {hashPwInput && (
                      <CopyButton text={hashPwInput} label="Copy password" style={{ flexShrink: 0, fontSize: 11, padding: "5px 10px" }} />
                    )}
                    <button className="pm-btn-primary" style={{ flexShrink: 0, fontSize: 11, padding: "5px 12px" }}
                      onClick={handleHashPassword}
                      disabled={hashPwLoading || !hashPwInput || hashPwInput !== hashPwConfirm}>
                      {hashPwLoading ? "Hashing…" : "Hash"}
                    </button>
                  </div>
                  {hashPwError && <div style={{ fontSize: 11, color: "var(--danger)" }}>{hashPwError}</div>}
                  {hashPwInput && hashPwConfirm && hashPwInput !== hashPwConfirm && (
                    <div style={{ fontSize: 11, color: "var(--danger)" }}>Passwords do not match</div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ background: "rgba(240,80,80,0.07)", border: "1px solid rgba(240,80,80,0.2)", borderRadius: "var(--r-sm)", padding: "10px 14px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            ⚠ This form is not saved — data exists only while you are filling it in.
            Download as PDF and store securely offline.
          </div>
        </div>
      </div>

      {/* ── Audit Log ─────────────────────────────────────────── */}
      <div className="pm-card">
        <div className="pm-section-header">
          <span className="pm-section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ClockIcon style={{ width: 14, height: 14 }} />
            Sign-in History
          </span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            last {auditLog.length} events (in-memory, resets on restart)
          </span>
        </div>

        <div style={{ padding: "0 12px 12px" }}>
          {auditLog.length === 0 ? (
            <div className="pm-empty">No events since the last server start.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {auditLog.map((ev, i) => (
                <div key={i} className="pm-audit-row">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                    {ev.success
                      ? <CheckCircleIcon style={{ width: 14, height: 14, color: "var(--success)", flexShrink: 0 }} />
                      : <XCircleIcon style={{ width: 14, height: 14, color: "var(--danger)", flexShrink: 0 }} />
                    }
                    <span style={{ fontSize: 12, color: ev.success ? "var(--success)" : "var(--danger)", fontWeight: 600 }}>
                      {ev.success ? "Success" : "Failed"}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{ev.ip}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {new Date(ev.timestamp).toLocaleString("en-GB")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
