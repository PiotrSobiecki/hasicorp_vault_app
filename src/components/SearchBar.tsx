"use client";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <input
      type="text"
      placeholder="Szukaj wpisów..."
      className="form-input w-full h-10 px-4 bg-[var(--bg-tertiary)] border border-[var(--border-color)] focus:border-[var(--accent-primary)] transition-colors"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
