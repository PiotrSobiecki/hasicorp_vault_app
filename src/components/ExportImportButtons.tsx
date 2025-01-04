"use client";

import { useState } from "react";
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
} from "@heroicons/react/24/outline";

interface ExportImportButtonsProps {
  onExport: () => void;
  onImport: (file: File) => void;
}

export default function ExportImportButtons({
  onExport,
  onImport,
}: ExportImportButtonsProps) {
  const handleImportClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) onImport(file);
    };
    input.click();
  };

  return (
    <div className="password-actions">
      <button
        onClick={onExport}
        className="button button-secondary"
        title="Eksportuj hasła"
      >
        <span>Eksportuj</span>
      </button>
      <button
        onClick={handleImportClick}
        className="button button-secondary"
        title="Importuj hasła"
      >
        <span>Importuj</span>
      </button>
    </div>
  );
}
