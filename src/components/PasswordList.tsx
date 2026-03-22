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
  ChevronDownIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";
import PasswordForm from "./PasswordForm";
import CopyButton from "./CopyButton";

// ── Favicon avatar ───────────────────────────────────────────
// Favicons are fetched via /api/favicon (server-side proxy) so the user's
// browser never contacts Google directly.
const faviconFailCache = new Set<string>();

function ItemAvatar({ title, url }: { title: string; url?: string }) {
  const domain = (() => {
    if (!url) return null;
    try {
      const h = new URL(url).hostname;
      return faviconFailCache.has(h) ? null : h;
    } catch {
      return null;
    }
  })();

  const src = domain ? `/api/favicon?domain=${encodeURIComponent(domain)}` : null;
  const [loaded, setLoaded] = useState<"pending" | "ok" | "fail">(
    src ? "pending" : "fail",
  );
  const initials = title.trim().slice(0, 2).toUpperCase() || "?";

  if (src && loaded !== "fail") {
    return (
      <div
        className="pm-item-avatar"
        style={{ background: "#1a2035", padding: loaded === "ok" ? 6 : undefined, position: "relative" }}
      >
        {loaded === "pending" && (
          <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {initials}
          </span>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          width={24}
          height={24}
          style={{ borderRadius: 4, display: loaded === "ok" ? "block" : "none" }}
          onLoad={() => setLoaded("ok")}
          onError={() => {
            if (domain) faviconFailCache.add(domain);
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
  selectedId: _selectedId,
  onPasswordSelect: _onPasswordSelect,
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
      console.error("Error fetching passwords:", error);
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
        toast({ title: "Entry deleted", status: "success", duration: 3000, isClosable: true });
      } else {
        toast({ title: "Failed to delete entry", status: "error", duration: 3000, isClosable: true });
      }
    } catch {
      toast({ title: "Error deleting entry", status: "error", duration: 3000, isClosable: true });
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
        toast({ title: "Changes saved", status: "success", duration: 3000, isClosable: true });
      } else {
        toast({ title: "Failed to save changes", status: "error", duration: 3000, isClosable: true });
      }
    } catch {
      toast({ title: "Error saving entry", status: "error", duration: 3000, isClosable: true });
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
      toast({ title: "Export ready", status: "success", duration: 3000, isClosable: true });
    } catch {
      toast({ title: "Export error", status: "error", duration: 3000, isClosable: true });
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

        // Try as plain JSON; if that fails — decrypt server-side (key is never exposed to the client)
        let importedData: { passwords: unknown[] };
        try {
          importedData = JSON.parse(text);
        } catch {
          const decryptRes = await fetch("/api/passwords/decrypt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ encryptedData: text }),
          });
          if (!decryptRes.ok) throw new Error("Decryption failed");
          const { data } = await decryptRes.json();
          importedData = data;
        }

        if (!importedData?.passwords || !Array.isArray(importedData.passwords)) {
          throw new Error("Invalid format");
        }

        const res = await fetch("/api/passwords/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passwords: importedData.passwords }),
        });
        if (res.ok) {
          await fetchPasswords();
          toast({ title: "Import complete", description: `Imported ${importedData.passwords.length} entries.`, status: "success", duration: 4000, isClosable: true });
        } else {
          toast({ title: "Import error", status: "error", duration: 3000, isClosable: true });
        }
      } catch {
        toast({ title: "Error during import", status: "error", duration: 3000, isClosable: true });
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
        <span className="pm-section-title">{filtered.length} {filtered.length === 1 ? "entry" : "entries"}</span>
        <div className="pm-section-actions">
          <button className="pm-btn-secondary" onClick={handleExport} title="Export to file">
            <ArrowDownTrayIcon style={{ width: 14, height: 14 }} />
            Export
          </button>
          <button className="pm-btn-secondary" onClick={handleImportClick} title="Import from file">
            <ArrowUpTrayIcon style={{ width: 14, height: 14 }} />
            Import
          </button>
        </div>
      </div>

      {/* ── List ───────────────────────────────────────────── */}
      <div className="pm-list">
        {filtered.length === 0 && (
          <div className="pm-empty">
            {searchQuery ? "No results for this search." : "No saved passwords. Add your first entry."}
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
                      <div className="pm-field-label">Username</div>
                      <div className="pm-field-row">
                        <input type="text" readOnly value={p.username} className="pm-field-input" />
                        <CopyButton variant="icon" text={p.username} iconSize={16} title="Copy username" />
                      </div>
                    </div>

                    {/* Password */}
                    <div className="pm-field">
                      <div className="pm-field-label">Password</div>
                      <div className="pm-field-row">
                        <input
                          type={showPasswordId === p.id ? "text" : "password"}
                          readOnly value={p.password}
                          className="pm-field-input"
                        />
                        <button className="pm-icon-btn" onClick={() => setShowPasswordId(showPasswordId === p.id ? null : p.id)} title={showPasswordId === p.id ? "Hide" : "Show"}>
                          {showPasswordId === p.id
                            ? <EyeSlashIcon style={{ width: 16, height: 16 }} />
                            : <EyeIcon style={{ width: 16, height: 16 }} />}
                        </button>
                        <CopyButton variant="icon" text={p.password} iconSize={16} title="Copy password" />
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
                          <CopyButton variant="icon" text={p.url!} iconSize={16} title="Copy URL" />
                        </div>
                      </div>
                    )}

                    {/* 2FA */}
                    {p.twoFactorCode && (
                      <div className="pm-field">
                        <div className="pm-field-label">2FA code</div>
                        <div className="pm-field-row">
                          <code className="pm-totp-code">{totpCodes[p.id] || "------"}</code>
                          <CopyButton variant="icon" text={(totpCodes[p.id] || "").split(" ")[0]} iconSize={16} title="Copy 2FA code" />
                        </div>
                      </div>
                    )}

                    {/* Extra key */}
                    {p.key && (
                      <div className="pm-field">
                        <div className="pm-field-label">Extra key</div>
                        <div className="pm-field-row">
                          <input
                            type={showKeyId === p.id ? "text" : "password"}
                            readOnly value={p.key}
                            className="pm-field-input"
                          />
                          <button className="pm-icon-btn" onClick={() => setShowKeyId(showKeyId === p.id ? null : p.id)} title={showKeyId === p.id ? "Hide" : "Show"}>
                            {showKeyId === p.id
                              ? <EyeSlashIcon style={{ width: 16, height: 16 }} />
                              : <EyeIcon style={{ width: 16, height: 16 }} />}
                          </button>
                          <CopyButton variant="icon" text={p.key!} iconSize={16} title="Copy key" />
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {p.notes && (
                      <div className="pm-field">
                        <div className="pm-field-label">Notes</div>
                        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, padding: "9px 12px", background: "var(--bg-input)", borderRadius: "var(--r-sm)", border: "1px solid var(--border)" }}>
                          {p.notes}
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pm-item-actions">
                      <button className="pm-icon-btn" onClick={() => setEditingPassword(p)} title="Edit">
                        <PencilIcon style={{ width: 16, height: 16 }} />
                      </button>
                      <button
                        className="pm-icon-btn danger"
                        onClick={() => { setPasswordToDelete(p); setConfirmDeleteChecked(false); }}
                        title="Delete"
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
              Delete entry
            </AlertDialogHeader>
            <AlertDialogBody pt={5} pb={3}>
              <p style={{ color: "#9ca3af", fontSize: 14, lineHeight: 1.6 }}>
                Wpis <strong style={{ color: "#e8eaf0" }}>{passwordToDelete?.title}</strong> zostanie
                {" "}<strong style={{ color: "#e8eaf0" }}>permanently deleted</strong> from HashiCorp Vault.
                This action cannot be undone.
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
                <span>I understand this entry will be permanently deleted.</span>
              </label>
            </AlertDialogBody>
            <AlertDialogFooter borderTop="1px solid" borderColor="whiteAlpha.100" gap={3} pt={4}>
              <Button ref={cancelRef} onClick={() => { setPasswordToDelete(null); setConfirmDeleteChecked(false); }}
                bg="whiteAlpha.100" color="gray.300" border="1px solid" borderColor="whiteAlpha.200"
                _hover={{ bg: "whiteAlpha.200", color: "white" }} borderRadius="8px" size="sm"
              >
                Cancel
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
                Delete forever
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialogOverlay>
      </AlertDialog>
    </>
  );
}
