"use client";

import { useState } from "react";
import {
  EyeIcon,
  EyeSlashIcon,
  ClipboardIcon,
} from "@heroicons/react/24/outline";
import { Password } from "@/types/password";

interface PasswordFormProps {
  initialData?: Password;
  onSuccess: (password: Password) => void;
  onCancel?: () => void;
}

export default function PasswordForm({
  initialData,
  onSuccess,
  onCancel,
}: PasswordFormProps) {
  const [formData, setFormData] = useState({
    title: initialData?.title || "",
    username: initialData?.username || "",
    password: initialData?.password || "",
    key: initialData?.key || "",
    passwordLength: 12,
    twoFactorCode: initialData?.twoFactorCode || "",
    url: initialData?.url || "",
    notes: initialData?.notes || "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const generatePassword = () => {
    const length = formData.passwordLength;
    const charset =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setFormData((prev) => ({ ...prev, password }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const url = initialData
        ? `/api/passwords/${initialData.id}`
        : "/api/passwords";

      const method = initialData ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const savedPassword = await response.json();
        setFormData({
          title: "",
          username: "",
          password: "",
          key: "",
          passwordLength: 12,
          twoFactorCode: "",
          url: "",
          notes: "",
        });
        onSuccess(savedPassword);
      }
    } catch (error) {
      console.error("Błąd podczas zapisywania hasła:", error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="form-group">
        <label className="form-label">Tytuł</label>
        <input
          type="text"
          className="form-input px-4 [&::-webkit-search-cancel-button]:hidden"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Nazwa użytkownika</label>
        <input
          type="text"
          className="form-input px-4"
          value={formData.username}
          onChange={(e) =>
            setFormData({ ...formData, username: e.target.value })
          }
          required
        />
      </div>

      <div className="form-group">
        <label className="form-label">Hasło</label>
        <div className="field-value">
          <input
            type={showPassword ? "text" : "password"}
            className="form-input"
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            required
          />
          <button
            type="button"
            className="icon-button"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <EyeSlashIcon className="h-5 w-5" />
            ) : (
              <EyeIcon className="h-5 w-5" />
            )}
          </button>
        </div>
        <div className="range-container">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="8"
              max="32"
              value={formData.passwordLength}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  passwordLength: parseInt(e.target.value),
                })
              }
              className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <span className="text-sm text-gray-400 min-w-[80px] text-right">
              {formData.passwordLength} znaków
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={generatePassword}
          className="button button-primary w-full"
        >
          Generuj hasło
        </button>
      </div>

      <div className="form-group">
        <label className="form-label">
          Dodatkowe hasło/klucz (opcjonalnie)
        </label>
        <div className="field-value">
          <input
            type={showKey ? "text" : "password"}
            className="form-input"
            value={formData.key}
            onChange={(e) => setFormData({ ...formData, key: e.target.value })}
          />
          <button
            type="button"
            className="icon-button"
            onClick={() => setShowKey(!showKey)}
          >
            {showKey ? (
              <EyeSlashIcon className="h-5 w-5" />
            ) : (
              <EyeIcon className="h-5 w-5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => copyToClipboard(formData.key)}
            className="icon-button"
            title="Kopiuj dodatkowe hasło/klucz"
          >
            <ClipboardIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Kod 2FA (opcjonalnie)</label>
        <input
          type="text"
          className="form-input px-4"
          value={formData.twoFactorCode}
          onChange={(e) =>
            setFormData({
              ...formData,
              twoFactorCode: e.target.value.replace(/\s+/g, ""),
            })
          }
          placeholder="CBY5447MAGBR9Y37"
        />
      </div>

      <div className="form-group">
        <label className="form-label">URL</label>
        <input
          type="url"
          className="form-input px-4"
          value={formData.url}
          onChange={(e) => setFormData({ ...formData, url: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Notatki</label>
        <textarea
          className="form-input px-4 py-3"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
        />
      </div>

      <div className="flex gap-4">
        <button type="submit" className="button button-primary flex-1">
          {initialData ? "Zapisz zmiany" : "Zapisz hasło"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="button button-secondary"
          >
            Anuluj
          </button>
        )}
      </div>
    </form>
  );
}
