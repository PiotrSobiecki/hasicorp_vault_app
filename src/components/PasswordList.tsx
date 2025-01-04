"use client";

import { useState, useEffect } from "react";
import { Password } from "@/types/password";
import { authenticator } from "otplib";
import {
  EyeIcon,
  EyeSlashIcon,
  TrashIcon,
  PencilIcon,
  ClipboardIcon,
} from "@heroicons/react/24/outline";
import { decrypt, encrypt } from "@/lib/encryption";
import PasswordForm from "./PasswordForm";
import ExportImportButtons from "./ExportImportButtons";

interface PasswordListProps {
  searchQuery: string;
  selectedId: string | null;
  onPasswordSelect: (id: string) => void;
}

export default function PasswordList({
  searchQuery,
  selectedId,
  onPasswordSelect,
}: PasswordListProps) {
  const [passwords, setPasswords] = useState<Password[]>([]);
  const [showPasswordId, setShowPasswordId] = useState<string | null>(null);
  const [showKeyId, setShowKeyId] = useState<string | null>(null);
  const [totpCodes, setTotpCodes] = useState<Record<string, string>>({});
  const [editingPassword, setEditingPassword] = useState<Password | null>(null);

  const fetchPasswords = async () => {
    try {
      const response = await fetch("/api/passwords");
      if (response.ok) {
        const data = await response.json();
        setPasswords(data);
      }
    } catch (error) {
      console.error("Błąd podczas pobierania haseł:", error);
    }
  };

  useEffect(() => {
    fetchPasswords();
  }, []);

  useEffect(() => {
    const updateTOTP = () => {
      const newCodes: Record<string, string> = {};
      passwords.forEach((password) => {
        if (password.twoFactorCode) {
          try {
            const timeRemaining = 30 - (Math.floor(Date.now() / 1000) % 30);
            newCodes[password.id] = `${authenticator.generate(
              password.twoFactorCode
            )} (${timeRemaining}s)`;
          } catch {
            newCodes[password.id] = "------";
          }
        }
      });
      setTotpCodes(newCodes);
    };

    updateTOTP();
    const interval = setInterval(updateTOTP, 1000);

    return () => clearInterval(interval);
  }, [passwords]);

  const deletePassword = async (id: string) => {
    if (!confirm("Czy na pewno chcesz usunąć to hasło?")) return;

    try {
      const response = await fetch(`/api/passwords/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchPasswords(); // Odśwież listę po usunięciu
      }
    } catch (error) {
      console.error("Błąd podczas usuwania hasła:", error);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // TODO: Dodać powiadomienie o skopiowaniu
    } catch (error) {
      console.error("Błąd kopiowania do schowka:", error);
    }
  };

  const filteredAndSortedPasswords = passwords
    .filter(
      (password) =>
        password.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        password.username.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      // Sortowanie alfabetyczne po tytule
      return a.title.localeCompare(b.title);
    });

  const handleEdit = (password: Password) => {
    if (confirm("Czy chcesz edytować to hasło?")) {
      setEditingPassword(password);
    }
  };

  const handleSaveEdit = async (updatedPassword: Password) => {
    try {
      const response = await fetch(`/api/passwords/${updatedPassword.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedPassword),
      });

      if (response.ok) {
        setEditingPassword(null);
        await fetchPasswords(); // Odśwież listę
      }
    } catch (error) {
      console.error("Błąd podczas aktualizacji hasła:", error);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch("/api/encrypt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            passwords,
            timestamp: new Date().toISOString(),
            version: "1.0",
          },
        }),
      });

      if (!response.ok) throw new Error("Błąd szyfrowania");

      const { encryptedData } = await response.json();

      const blob = new Blob([encryptedData], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `passwords-${new Date().toISOString()}.encrypted`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Błąd podczas eksportu:", error);
      alert("Wystąpił błąd podczas eksportu haseł");
    }
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const decryptedData = decrypt(
        text,
        process.env.NEXT_PUBLIC_ENCRYPTION_KEY!
      );
      const importedData = JSON.parse(decryptedData);

      if (!importedData.passwords || !Array.isArray(importedData.passwords)) {
        throw new Error("Nieprawidłowy format pliku");
      }

      const confirmation = confirm(
        `Czy chcesz zaimportować ${importedData.passwords.length} haseł? Ta operacja nadpisze istniejące hasła.`
      );

      if (confirmation) {
        // Tutaj możemy dodać endpoint API do importu haseł
        const response = await fetch("/api/passwords/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passwords: importedData.passwords }),
        });

        if (response.ok) {
          await fetchPasswords();
          alert("Hasła zostały zaimportowane pomyślnie");
        }
      }
    } catch (error) {
      console.error("Błąd podczas importu:", error);
      alert("Wystąpił błąd podczas importu haseł");
    }
  };

  return (
    <div className="space-y-8">
      <div className="password-header">
        <h2 className="section-title mb-0">Zapisane hasła</h2>
        <ExportImportButtons onExport={handleExport} onImport={handleImport} />
      </div>
      <div className="space-y-6">
        {filteredAndSortedPasswords.map((password) => (
          <div key={password.id} className="password-item">
            {editingPassword?.id === password.id ? (
              <PasswordForm
                initialData={password}
                onSuccess={(updatedPassword) => handleSaveEdit(updatedPassword)}
                onCancel={() => setEditingPassword(null)}
              />
            ) : (
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 space-y-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-200">
                      {password.title}
                    </h3>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Nazwa użytkownika</label>
                    <div className="field-value">
                      <input
                        type="text"
                        readOnly
                        value={password.username}
                        className="form-input"
                      />
                      <button
                        onClick={() => copyToClipboard(password.username)}
                        className="icon-button"
                        title="Kopiuj nazwę użytkownika"
                      >
                        <ClipboardIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Hasło</label>
                    <div className="field-value">
                      <input
                        type={
                          showPasswordId === password.id ? "text" : "password"
                        }
                        value={password.password}
                        readOnly
                        className="form-input"
                      />
                      <button
                        onClick={() =>
                          setShowPasswordId(
                            showPasswordId === password.id ? null : password.id
                          )
                        }
                        className="icon-button"
                        title={
                          showPasswordId === password.id
                            ? "Ukryj hasło"
                            : "Pokaż hasło"
                        }
                      >
                        {showPasswordId === password.id ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                      <button
                        onClick={() => copyToClipboard(password.password)}
                        className="icon-button"
                        title="Kopiuj hasło"
                      >
                        <ClipboardIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {password.url && (
                    <div className="form-group">
                      <label className="form-label">URL</label>
                      <div className="field-value">
                        <a
                          href={password.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="form-input text-blue-400 hover:text-blue-300"
                        >
                          {password.url}
                        </a>
                        <button
                          onClick={() => copyToClipboard(password.url || "")}
                          className="icon-button"
                          title="Kopiuj URL"
                        >
                          <ClipboardIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {password.twoFactorCode && (
                    <div className="form-group">
                      <label className="form-label">Kod 2FA</label>
                      <div className="field-value">
                        <code className="form-input font-mono">
                          {totpCodes[password.id] || "------"}
                        </code>
                        <button
                          onClick={() =>
                            copyToClipboard(totpCodes[password.id] || "")
                          }
                          className="icon-button"
                          title="Kopiuj kod 2FA"
                        >
                          <ClipboardIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {password.notes && (
                    <div className="form-group">
                      <label className="form-label">Notatki</label>
                      <p className="notes-container">{password.notes}</p>
                    </div>
                  )}

                  {password.key && (
                    <div className="form-group">
                      <label className="form-label">
                        Dodatkowe hasło/klucz
                      </label>
                      <div className="field-value">
                        <input
                          type={showKeyId === password.id ? "text" : "password"}
                          value={password.key}
                          readOnly
                          className="form-input"
                        />
                        <button
                          onClick={() =>
                            setShowKeyId(
                              showKeyId === password.id ? null : password.id
                            )
                          }
                          className="icon-button"
                          title={
                            showKeyId === password.id
                              ? "Ukryj dodatkowe hasło/klucz"
                              : "Pokaż dodatkowe hasło/klucz"
                          }
                        >
                          {showKeyId === password.id ? (
                            <EyeSlashIcon className="h-5 w-5" />
                          ) : (
                            <EyeIcon className="h-5 w-5" />
                          )}
                        </button>
                        <button
                          onClick={() => copyToClipboard(password.key || "")}
                          className="icon-button"
                          title="Kopiuj dodatkowe hasło/klucz"
                        >
                          <ClipboardIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="actions">
                  <button
                    onClick={() => handleEdit(password)}
                    className="icon-button"
                    title="Edytuj hasło"
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => deletePassword(password.id)}
                    className="icon-button text-red-400"
                    title="Usuń hasło"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
