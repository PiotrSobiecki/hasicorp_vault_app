"use client";

import { useState } from "react";
import { useToast } from "@chakra-ui/react";
import { EyeIcon, EyeSlashIcon, ClipboardIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { Password } from "@/types/password";

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

  const set = (field: string, value: string | number) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const generatePassword = () => {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    const randomValues = new Uint32Array(formData.passwordLength);
    crypto.getRandomValues(randomValues);
    const pw = Array.from(randomValues)
      .map((v) => charset[v % charset.length])
      .join("");
    set("password", pw);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url    = initialData ? `/api/passwords/${initialData.id}` : "/api/passwords";
      const method = initialData ? "PUT" : "POST";
      // Nie wysyłaj pola UI (passwordLength) do API
      const { passwordLength: _ignored, ...payload } = formData;
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      toast({ title: initialData ? "Zapisano zmiany" : "Wpis dodany", status: "success", duration: 3000, isClosable: true });
      onSuccess(saved);
    } catch {
      toast({ title: "Błąd podczas zapisywania", status: "error", duration: 3000, isClosable: true });
    }
  };

  const copy = (text: string) => navigator.clipboard.writeText(text);

  return (
    <form onSubmit={handleSubmit} className="pm-form">
      <div className="pm-form-title">{initialData ? "Edytuj wpis" : "Nowy wpis"}</div>

      {/* Title */}
      <div className="pm-form-group">
        <label className="pm-form-label">Tytuł *</label>
        <input className="pm-form-input" type="text" required
          placeholder="np. Gmail, GitHub…"
          value={formData.title} onChange={(e) => set("title", e.target.value)} />
      </div>

      {/* Username */}
      <div className="pm-form-group">
        <label className="pm-form-label">Nazwa użytkownika *</label>
        <input className="pm-form-input" type="text" required
          placeholder="login lub e-mail"
          value={formData.username} onChange={(e) => set("username", e.target.value)} />
      </div>

      {/* Password */}
      <div className="pm-form-group">
        <label className="pm-form-label">Hasło *</label>
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
          <span className="pm-slider-label">{formData.passwordLength} znaków</span>
        </div>
        <button type="button" className="pm-btn-secondary" style={{ marginTop: 8, width: "100%", justifyContent: "center" }} onClick={generatePassword}>
          <SparklesIcon style={{ width: 14, height: 14 }} />
          Generuj hasło
        </button>
      </div>

      {/* Extra key */}
      <div className="pm-form-group">
        <label className="pm-form-label">Dodatkowy klucz <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(opcjonalnie)</span></label>
        <div className="pm-form-row">
          <input className="pm-form-input" type={showKey ? "text" : "password"}
            value={formData.key} onChange={(e) => set("key", e.target.value)} />
          <button type="button" className="pm-icon-btn" onClick={() => setShowKey(!showKey)}>
            {showKey ? <EyeSlashIcon style={{ width: 16, height: 16 }} /> : <EyeIcon style={{ width: 16, height: 16 }} />}
          </button>
          <button type="button" className="pm-icon-btn" onClick={() => copy(formData.key)} title="Kopiuj">
            <ClipboardIcon style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </div>

      {/* 2FA */}
      <div className="pm-form-group">
        <label className="pm-form-label">Seed 2FA <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(opcjonalnie)</span></label>
        <input className="pm-form-input" type="text"
          placeholder="CBY5447MAGBR9Y37"
          value={formData.twoFactorCode}
          onChange={(e) => set("twoFactorCode", e.target.value.replace(/\s+/g, ""))} />
      </div>

      {/* URL */}
      <div className="pm-form-group">
        <label className="pm-form-label">URL <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(opcjonalnie)</span></label>
        <input className="pm-form-input" type="url"
          placeholder="https://example.com"
          value={formData.url} onChange={(e) => set("url", e.target.value)} />
      </div>

      {/* Notes */}
      <div className="pm-form-group">
        <label className="pm-form-label">Notatki <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(opcjonalnie)</span></label>
        <textarea className="pm-form-input" rows={3}
          value={formData.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>

      {/* Actions */}
      <div className="pm-form-actions">
        <button type="submit" className="pm-btn-primary">
          {initialData ? "Zapisz zmiany" : "Dodaj wpis"}
        </button>
        {onCancel && (
          <button type="button" className="pm-btn-ghost" onClick={onCancel}>
            Anuluj
          </button>
        )}
      </div>
    </form>
  );
}
