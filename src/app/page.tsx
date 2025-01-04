"use client";

import { useState } from "react";
import PasswordForm from "@/components/PasswordForm";
import PasswordList from "@/components/PasswordList";
import { PlusIcon } from "@heroicons/react/24/outline";
import SearchBar from "@/components/SearchBar";

export default function Home() {
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handlePasswordAdded = () => {
    setIsFormVisible(false);
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="password-container">
      <div className="mb-6">
        <h1 className="section-title mb-4">Menedżer Haseł</h1>
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="section-title mb-0"></h1>
        <button
          onClick={() => setIsFormVisible(!isFormVisible)}
          className="button button-primary px-6 h-10 whitespace-nowrap"
        >
          <PlusIcon className="h-5 w-5" />
          <span>Nowy wpis</span>
        </button>
      </div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="section-title mb-0"></h1>
      </div>
      {isFormVisible && (
        <div className="password-item mb-6 animate-slideDown">
          <div className="flex justify-between items-center mb-4">
            <h2 className="section-title mb-0">Nowe dane logowania</h2>
          </div>
          <PasswordForm onSuccess={handlePasswordAdded} />
        </div>
      )}

      <PasswordList
        searchQuery={searchQuery}
        selectedId={null}
        onPasswordSelect={() => {}}
        key={refreshTrigger}
      />
    </div>
  );
}
