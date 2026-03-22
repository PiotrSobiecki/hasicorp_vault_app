"use client";

import { useState } from "react";
import { useToast } from "@chakra-ui/react";
import { EyeIcon, EyeSlashIcon, SparklesIcon, QrCodeIcon } from "@heroicons/react/24/outline";
import { Password } from "@/types/password";
import QrScanner from "./QrScanner";
import CopyButton from "./CopyButton";

interface PasswordFormProps {
  initialData?: Password;
  onSuccess: (password: Password) => void;
  onCancel?: () => void;
}

export default function PasswordForm({ initialData, onSuccess, onCancel }: PasswordFormProps) {
  const toast = useToast();
  const [formData, setFormData] = useState({
    title:          initialData?.title || "",
    username:       initialData?.username || "",
    password:       initialData?.password || "",
    key:            initialData?.key || "",
    passwordLength: 16,
    twoFactorCode:  initialData?.twoFactorCode || "",
    url:            initialData?.url || "",
    notes:          initialData?.notes || "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);

  const set = (field: string, value: string | number) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const generatePassword = () => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    // Rejection sampling eliminates modulo bias (2^32 is not divisible by charset.length)
    const max = Math.floor(0x1_0000_0000 / charset.length) * charset.length;
    const result: string[] = [];
    while (result.length < formData.passwordLength) {
      const buf = new Uint32Array(formData.passwordLength - result.length);
      crypto.getRandomValues(buf);
      for (const v of buf) {
        if (v < max && result.length < formData.passwordLength) {
          result.push(charset[v % charset.length]);
        }
      }
    }
    set("password", result.join(""));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url    = initialData ? `/api/passwords/${initialData.id}` : "/api/passwords";
      const method = initialData ? "PUT" : "POST";
      // Don't send the UI-only field (passwordLength) to the API
      const { passwordLength: _pl, ...payload } = formData;
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      toast({ title: initialData ? "Changes saved" : "Entry added", status: "success", duration: 3000, isClosable: true });
      onSuccess(saved);
    } catch {
      toast({ title: "Error saving entry", status: "error", duration: 3000, isClosable: true });
    }
  };


  return (
    <form onSubmit={handleSubmit} className="pm-form">
      <div className="pm-form-title">{initialData ? "Edit entry" : "New entry"}</div>

      {/* Title */}
      <div className="pm-form-group">
        <label className="pm-form-label">Title *</label>
        <input className="pm-form-input" type="text" required
          placeholder="e.g. Gmail, GitHub…"
          value={formData.title} onChange={(e) => set("title", e.target.value)} />
      </div>

      {/* Username */}
      <div className="pm-form-group">
        <label className="pm-form-label">Username *</label>
        <input className="pm-form-input" type="text" required
          placeholder="login or e-mail"
          value={formData.username} onChange={(e) => set("username", e.target.value)} />
      </div>

      {/* Password */}
      <div className="pm-form-group">
        <label className="pm-form-label">Password *</label>
        <div className="pm-form-row">
          <input className="pm-form-input" type={showPassword ? "text" : "password"} required
            value={formData.password} onChange={(e) => set("password", e.target.value)} />
          <button type="button" className="pm-icon-btn" onClick={() => setShowPassword(!showPassword)}>
            {showPassword ? <EyeSlashIcon style={{ width: 16, height: 16 }} /> : <EyeIcon style={{ width: 16, height: 16 }} />}
          </button>
        </div>
        {/* Slider + generate */}
        <div className="pm-slider-row" style={{ marginTop: 8 }}>
          <input
            type="range" min={8} max={32} className="pm-slider"
            value={formData.passwordLength}
            onChange={(e) => set("passwordLength", parseInt(e.target.value))}
          />
          <span className="pm-slider-label">{formData.passwordLength} chars</span>
        </div>
        <button type="button" className="pm-btn-secondary" style={{ marginTop: 8, width: "100%", justifyContent: "center" }} onClick={generatePassword}>
          <SparklesIcon style={{ width: 14, height: 14 }} />
          Generate password
        </button>
      </div>

      {/* Extra key */}
      <div className="pm-form-group">
        <label className="pm-form-label">Extra key <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label>
        <div className="pm-form-row">
          <input className="pm-form-input" type={showKey ? "text" : "password"}
            value={formData.key} onChange={(e) => set("key", e.target.value)} />
          <button type="button" className="pm-icon-btn" onClick={() => setShowKey(!showKey)}>
            {showKey ? <EyeSlashIcon style={{ width: 16, height: 16 }} /> : <EyeIcon style={{ width: 16, height: 16 }} />}
          </button>
          <CopyButton variant="icon" text={formData.key} iconSize={16} title="Copy key" />
        </div>
      </div>

      {/* 2FA */}
      <div className="pm-form-group">
        <label className="pm-form-label">2FA seed <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label>
        <div className="pm-form-row">
          <input className="pm-form-input" type="text"
            placeholder="CBY5447MAGBR9Y37"
            value={formData.twoFactorCode}
            onChange={(e) => set("twoFactorCode", e.target.value.replace(/\s+/g, ""))} />
          <button type="button" className="pm-icon-btn" title="Scan QR code" onClick={() => setShowQrScanner(true)}>
            <QrCodeIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </div>

      {showQrScanner && (
        <QrScanner
          onScan={(secret) => {
            set("twoFactorCode", secret);
            setShowQrScanner(false);
          }}
          onClose={() => setShowQrScanner(false)}
        />
      )}

      {/* URL */}
      <div className="pm-form-group">
        <label className="pm-form-label">URL <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label>
        <input className="pm-form-input" type="url"
          placeholder="https://example.com"
          value={formData.url} onChange={(e) => set("url", e.target.value)} />
      </div>

      {/* Notes */}
      <div className="pm-form-group">
        <label className="pm-form-label">Notes <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span></label>
        <textarea className="pm-form-input" rows={3}
          value={formData.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>

      {/* Actions */}
      <div className="pm-form-actions">
        <button type="submit" className="pm-btn-primary">
          {initialData ? "Save changes" : "Add entry"}
        </button>
        {onCancel && (
          <button type="button" className="pm-btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
