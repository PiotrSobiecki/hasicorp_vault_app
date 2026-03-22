"use client";

import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="pm-search-wrap">
      <MagnifyingGlassIcon className="pm-search-icon" style={{ width: 15, height: 15 }} />
      <input
        type="text"
        placeholder="Search entries..."
        className="pm-search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
