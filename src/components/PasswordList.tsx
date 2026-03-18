"use client";

import { useState, useEffect, useRef } from "react";
import {
  useToast,
  AlertDialog,
  AlertDialogBody,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogContent,
  AlertDialogOverlay,
  Button,
} from "@chakra-ui/react";
import { Password } from "@/types/password";
import { authenticator } from "otplib";
import {
  EyeIcon,
  EyeSlashIcon,
  TrashIcon,
  PencilIcon,
  ClipboardIcon,
  ChevronDownIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";
import PasswordForm from "./PasswordForm";

// ── Favicon avatar ───────────────────────────────────────────
// Cache wyników poza komponentem – persystuje między renderami w sesji
const faviconFailCache = new Set<string>();

function ItemAvatar({ title, url }: { title: string; url?: string }) {
  const src = (() => {
    if (!url) return null;
    try {
      const domain = new URL(url).hostname;
      if (faviconFailCache.has(domain)) return null;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=48`;
    } catch {
      return null;
    }
  })();

  const [loaded, setLoaded] = useState<"pending" | "ok" | "fail">(
    src ? "pending" : "fail",
  );

  const initials = title.trim().slice(0, 2).toUpperCase() || "?";

  if (src && loaded !== "fail") {
    return (
      <div className="pm-item-avatar" style={{ background: "#1a2035", padding: loaded === "ok" ? 6 : undefined, position: "relative" }}>
        {/* Inicjały widoczne dopóki favicon się ładuje */}
        {loaded === "pending" && <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{initials}</span>}
        <img
          src={src}
          alt=""
          width={24}
          height={24}
          style={{ borderRadius: 4, display: loaded === "ok" ? "block" : "none" }}
          onLoad={() => setLoaded("ok")}
          onError={() => {
            try { faviconFailCache.add(new URL(url!).hostname); } catch {}
            setLoaded("fail");
          }}
        />
      </div>
    );
  }

  return <div className="pm-item-avatar">{initials}</div>;
}

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
  const toast = useToast();
  const [passwords, setPasswords] = useState<Password[]>([]);
  const [showPasswordId, setShowPasswordId] = useState<string | null>(null);
  const [showKeyId, setShowKeyId] = useState<string | null>(null);
  const [totpCodes, setTotpCodes] = useState<Record<string, string>>({});
  const [editingPassword, setEditingPassword] = useState<Password | null>(null);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [passwordToDelete, setPasswordToDelete] = useState<Password | null>(null);
  const [confirmDeleteChecked, setConfirmDeleteChecked] = useState(false);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

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

  useEffect(() => { fetchPasswords(); }, []);

  useEffect(() => {
    const updateTOTP = () => {
      const newCodes: Record<string, string> = {};
      passwords.forEach((p) => {
        if (p.twoFactorCode) {
          try {
            const remaining = 30 - (Math.floor(Date.now() / 1000) % 30);
            newCodes[p.id] = `${authenticator.generate(p.twoFactorCode)} (${remaining}s)`;
          } catch {
            newCodes[p.id] = "------";
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
    try {
      const res = await fetch(`/api/passwords/${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchPasswords();
        toast({ title: "Wpis usunięty", status: "success", duration: 3000, isClosable: true });
      } else {
        toast({ title: "Nie udało się usunąć wpisu", status: "error", duration: 3000, isClosable: true });
      }
    } catch {
      toast({ title: "Błąd podczas usuwania", status: "error", duration: 3000, isClosable: true });
    }
  };

  const copy = async (text: string, label = "Skopiowano") => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: label, status: "success", duration: 1800, isClosable: true });
    } catch {
      toast({ title: "Błąd kopiowania", status: "error", duration: 2000, isClosable: true });
    }
  };

  const handleSaveEdit = async (updated: Password) => {
    try {
      const res = await fetch(`/api/passwords/${updated.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (res.ok) {
        setEditingPassword(null);
        await fetchPasswords();
        toast({ title: "Zapisano zmiany", status: "success", duration: 3000, isClosable: true });
      } else {
        toast({ title: "Nie udało się zapisać zmian", status: "error", duration: 3000, isClosable: true });
      }
    } catch {
      toast({ title: "Błąd podczas zapisywania", status: "error", duration: 3000, isClosable: true });
    }
  };

  /* ── Export ─────────────────────────────────────────────── */
  const handleExport = async () => {
    try {
      const res = await fetch("/api/encrypt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { passwords, timestamp: new Date().toISOString(), version: "1.0" } }),
      });
      if (!res.ok) throw new Error();
      const { encryptedData } = await res.json();
      const fileName = `vault-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const blob = new Blob([encryptedData], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fileName;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      toast({ title: "Eksport gotowy", status: "success", duration: 3000, isClosable: true });
    } catch {
      toast({ title: "Błąd eksportu", status: "error", duration: 3000, isClosable: true });
    }
  };

  /* ── Import ─────────────────────────────────────────────── */
  const handleImportClick = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();

        // Spróbuj jako plain JSON; jeśli nie – odszyfruj server-side (klucz nie jest wystawiany klientowi)
        let importedData: any;
        try {
          importedData = JSON.parse(text);
        } catch {
          const decryptRes = await fetch("/api/passwords/decrypt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ encryptedData: text }),
          });
          if (!decryptRes.ok) throw new Error("Deszyfrowanie nie powiodło się");
          const { data } = await decryptRes.json();
          importedData = data;
        }

        if (!importedData?.passwords || !Array.isArray(importedData.passwords)) {
          throw new Error("Nieprawidłowy format");
        }

        const res = await fetch("/api/passwords/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passwords: importedData.passwords }),
        });
        if (res.ok) {
          await fetchPasswords();
          toast({ title: "Import zakończony", description: `Zaimportowano ${importedData.passwords.length} wpisów.`, status: "success", duration: 4000, isClosable: true });
        } else {
          toast({ title: "Błąd importu", status: "error", duration: 3000, isClosable: true });
        }
      } catch {
        toast({ title: "Błąd podczas importu", status: "error", duration: 3000, isClosable: true });
      }
    };
    input.click();
  };

  const filtered = passwords
    .filter((p) =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.username.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => a.title.localeCompare(b.title));


  return (
    <>
      {/* ── Section header ─────────────────────────────────── */}
      <div className="pm-section-header">
        <span className="pm-section-title">{filtered.length} wpisów</span>
        <div className="pm-section-actions">
          <button className="pm-btn-secondary" onClick={handleExport} title="Eksportuj do pliku">
            <ArrowDownTrayIcon style={{ width: 14, height: 14 }} />
            Eksportuj
          </button>
          <button className="pm-btn-secondary" onClick={handleImportClick} title="Importuj z pliku">
            <ArrowUpTrayIcon style={{ width: 14, height: 14 }} />
            Importuj
          </button>
        </div>
      </div>

      {/* ── List ───────────────────────────────────────────── */}
      <div className="pm-list">
        {filtered.length === 0 && (
          <div className="pm-empty">
            {searchQuery ? "Brak wyników dla podanej frazy." : "Brak zapisanych haseł. Dodaj pierwszy wpis."}
          </div>
        )}

        {filtered.map((p) => (
          <div key={p.id} className="pm-item">
            {editingPassword?.id === p.id ? (
              <PasswordForm
                initialData={p}
                onSuccess={(updated) => handleSaveEdit(updated)}
                onCancel={() => setEditingPassword(null)}
              />
            ) : (
              <>
                {/* ── Item header ──────────────────────────── */}
                <div
                  className="pm-item-header"
                  onClick={() => setExpandedIds((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                >
                  <ItemAvatar title={p.title} url={p.url} />
                  <div className="pm-item-meta">
                    <div className="pm-item-title">{p.title}</div>
                    <div className="pm-item-username">{p.username}</div>
                  </div>
                  <ChevronDownIcon
                    className={`pm-item-chevron ${expandedIds[p.id] ? "open" : ""}`}
                    style={{ width: 16, height: 16 }}
                  />
                </div>

                {/* ── Expanded body ─────────────────────────── */}
                {expandedIds[p.id] && (
                  <div className="pm-item-body">

                    {/* Username */}
                    <div className="pm-field">
                      <div className="pm-field-label">Nazwa użytkownika</div>
                      <div className="pm-field-row">
                        <input type="text" readOnly value={p.username} className="pm-field-input" />
                        <button className="pm-icon-btn" onClick={() => copy(p.username, "Skopiowano login")} title="Kopiuj">
                          <ClipboardIcon style={{ width: 16, height: 16 }} />
                        </button>
                      </div>
                    </div>

                    {/* Password */}
                    <div className="pm-field">
                      <div className="pm-field-label">Hasło</div>
                      <div className="pm-field-row">
                        <input
                          type={showPasswordId === p.id ? "text" : "password"}
                          readOnly value={p.password}
                          className="pm-field-input"
                        />
                        <button className="pm-icon-btn" onClick={() => setShowPasswordId(showPasswordId === p.id ? null : p.id)} title={showPasswordId === p.id ? "Ukryj" : "Pokaż"}>
                          {showPasswordId === p.id
                            ? <EyeSlashIcon style={{ width: 16, height: 16 }} />
                            : <EyeIcon style={{ width: 16, height: 16 }} />}
                        </button>
                        <button className="pm-icon-btn" onClick={() => copy(p.password, "Skopiowano hasło")} title="Kopiuj">
                          <ClipboardIcon style={{ width: 16, height: 16 }} />
                        </button>
                      </div>
                    </div>

                    {/* URL */}
                    {p.url && (
                      <div className="pm-field">
                        <div className="pm-field-label">URL</div>
                        <div className="pm-field-row">
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="pm-field-input" style={{ color: "#5a9fff", textDecoration: "none", display: "flex", alignItems: "center" }}>
                            {p.url}
                          </a>
                          <button className="pm-icon-btn" onClick={() => copy(p.url!, "Skopiowano URL")} title="Kopiuj">
                            <ClipboardIcon style={{ width: 16, height: 16 }} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 2FA */}
                    {p.twoFactorCode && (
                      <div className="pm-field">
                        <div className="pm-field-label">Kod 2FA</div>
                        <div className="pm-field-row">
                          <code className="pm-totp-code">{totpCodes[p.id] || "------"}</code>
                          <button className="pm-icon-btn" onClick={() => copy(totpCodes[p.id] || "", "Skopiowano kod 2FA")} title="Kopiuj">
                            <ClipboardIcon style={{ width: 16, height: 16 }} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Extra key */}
                    {p.key && (
                      <div className="pm-field">
                        <div className="pm-field-label">Dodatkowy klucz</div>
                        <div className="pm-field-row">
                          <input
                            type={showKeyId === p.id ? "text" : "password"}
                            readOnly value={p.key}
                            className="pm-field-input"
                          />
                          <button className="pm-icon-btn" onClick={() => setShowKeyId(showKeyId === p.id ? null : p.id)} title={showKeyId === p.id ? "Ukryj" : "Pokaż"}>
                            {showKeyId === p.id
                              ? <EyeSlashIcon style={{ width: 16, height: 16 }} />
                              : <EyeIcon style={{ width: 16, height: 16 }} />}
                          </button>
                          <button className="pm-icon-btn" onClick={() => copy(p.key!, "Skopiowano klucz")} title="Kopiuj">
                            <ClipboardIcon style={{ width: 16, height: 16 }} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {p.notes && (
                      <div className="pm-field">
                        <div className="pm-field-label">Notatki</div>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, padding: "9px 12px", background: "var(--bg-input)", borderRadius: "var(--r-sm)", border: "1px solid var(--border)" }}>
                          {p.notes}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pm-item-actions">
                      <button className="pm-icon-btn" onClick={() => setEditingPassword(p)} title="Edytuj">
                        <PencilIcon style={{ width: 16, height: 16 }} />
                      </button>
                      <button
                        className="pm-icon-btn danger"
                        onClick={() => { setPasswordToDelete(p); setConfirmDeleteChecked(false); }}
                        title="Usuń"
                      >
                        <TrashIcon style={{ width: 16, height: 16 }} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {/* ── Delete dialog ───────────────────────────────────── */}
      <AlertDialog isOpen={!!passwordToDelete} leastDestructiveRef={cancelRef} onClose={() => setPasswordToDelete(null)}>
        <AlertDialogOverlay bg="blackAlpha.800" backdropFilter="blur(6px)">
          <AlertDialogContent
            bg="#111318" border="1px solid" borderColor="whiteAlpha.100"
            borderRadius="14px" boxShadow="0 32px 80px rgba(0,0,0,0.85)"
            color="gray.100" mx={4}
          >
            <AlertDialogHeader fontSize="15px" fontWeight="700" borderBottom="1px solid" borderColor="whiteAlpha.100" pb={4} display="flex" alignItems="center" gap={2} color="red.400">
              <TrashIcon style={{ width: 18, height: 18 }} />
              Usuń wpis
            </AlertDialogHeader>
            <AlertDialogBody pt={5} pb={3}>
              <p style={{ color: "#9ca3af", fontSize: 14, lineHeight: 1.6 }}>
                Wpis <strong style={{ color: "#e8eaf0" }}>{passwordToDelete?.title}</strong> zostanie
                {" "}<strong style={{ color: "#e8eaf0" }}>trwale usunięty</strong> z HashiCorp Vault.
                Tej operacji nie można cofnąć.
              </p>
              <label style={{
                marginTop: 16, display: "flex", alignItems: "flex-start", gap: 10,
                fontSize: 13, color: "#6b7280", cursor: "pointer",
                padding: "12px 14px", background: "rgba(240,80,80,0.07)",
                borderRadius: 8, border: "1px solid rgba(240,80,80,0.2)",
              }}>
                <input
                  type="checkbox"
                  style={{ marginTop: 2, accentColor: "#f05050", width: 15, height: 15 }}
                  checked={confirmDeleteChecked}
                  onChange={(e) => setConfirmDeleteChecked(e.target.checked)}
                />
                <span>Rozumiem, że wpis zostanie bezpowrotnie usunięty.</span>
              </label>
            </AlertDialogBody>
            <AlertDialogFooter borderTop="1px solid" borderColor="whiteAlpha.100" gap={3} pt={4}>
              <Button ref={cancelRef} onClick={() => { setPasswordToDelete(null); setConfirmDeleteChecked(false); }}
                bg="whiteAlpha.100" color="gray.300" border="1px solid" borderColor="whiteAlpha.200"
                _hover={{ bg: "whiteAlpha.200", color: "white" }} borderRadius="8px" size="sm"
              >
                Anuluj
              </Button>
              <Button
                isDisabled={!confirmDeleteChecked}
                onClick={async () => {
                  if (passwordToDelete && confirmDeleteChecked) {
                    await deletePassword(passwordToDelete.id);
                    setPasswordToDelete(null);
                    setConfirmDeleteChecked(false);
                  }
                }}
                bg="red.600" color="white" _hover={{ bg: "red.500" }}
                _disabled={{ bg: "rgba(240,80,80,0.15)", color: "rgba(240,80,80,0.35)", cursor: "not-allowed" }}
                borderRadius="8px" size="sm"
                leftIcon={<TrashIcon style={{ width: 14, height: 14 }} />}
              >
                Usuń na zawsze
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
