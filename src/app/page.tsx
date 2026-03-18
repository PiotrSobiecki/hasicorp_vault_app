"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import PasswordForm from "@/components/PasswordForm";
import PasswordList from "@/components/PasswordList";
import { PlusIcon } from "@heroicons/react/24/outline";
import SearchBar from "@/components/SearchBar";

export default function Home() {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const router = useRouter();

  const handlePasswordAdded = () => {
    setIsFormVisible(false);
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="pm-app">
      {/* ── Header ─────────────────────────────────────────── */}
      <header className="pm-header">
        <div className="pm-logo">
          <div className="pm-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div>
            <div className="pm-logo-title">Vault Manager</div>
            <div className="pm-logo-subtitle">HashiCorp Vault</div>
          </div>
        </div>
        <button
          onClick={async () => {
            await fetch("/api/logout", { method: "POST" });
            router.push("/login");
          }}
          className="pm-logout-btn"
          title="Zablokuj sejf"
        >
          ⏻
        </button>
      </header>

      {/* ── Main card ──────────────────────────────────────── */}
      <div className="pm-card">
        {/* Toolbar: search + new */}
        <div className="pm-toolbar">
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
          <button
            onClick={() => setIsFormVisible(!isFormVisible)}
            className="pm-btn-primary"
          >
            <PlusIcon style={{ width: 15, height: 15 }} />
            Nowy wpis
          </button>
        </div>

        {/* New-entry form */}
        {isFormVisible && (
          <PasswordForm
            onSuccess={handlePasswordAdded}
            onCancel={() => setIsFormVisible(false)}
          />
        )}

        {/* List */}
        <PasswordList
          searchQuery={searchQuery}
          selectedId={null}
          onPasswordSelect={() => {}}
          key={refreshTrigger}
        />
      </div>
    </div>
  );
}
