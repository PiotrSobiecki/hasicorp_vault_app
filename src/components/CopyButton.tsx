"use client";

import { useState } from "react";
import { ClipboardIcon, CheckIcon, DocumentDuplicateIcon } from "@heroicons/react/24/outline";

interface CopyButtonProps {
  text: string;
  /** "icon" = clipboard icon only (for inline fields), "button" = text button with icon */
  variant?: "icon" | "button";
  label?: string;
  className?: string;
  style?: React.CSSProperties;
  iconSize?: number;
  title?: string;
}

export default function CopyButton({
  text,
  variant = "button",
  label = "Copy",
  className,
  style,
  iconSize = 13,
  title,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        className={className ?? "pm-icon-btn"}
        style={style}
        onClick={handleCopy}
        title={copied ? "Skopiowano!" : (title ?? "Kopiuj")}
      >
        {copied
          ? <CheckIcon style={{ width: iconSize, height: iconSize, color: "var(--success)", transition: "all 0.15s" }} />
          : <ClipboardIcon style={{ width: iconSize, height: iconSize }} />
        }
      </button>
    );
  }

  return (
    <button
      type="button"
      className={className ?? "pm-btn-secondary"}
      style={{
        flexShrink: 0,
        fontSize: 11,
        padding: "5px 10px",
        transition: "all 0.15s",
        ...(copied ? { color: "var(--success)", borderColor: "rgba(0,200,120,0.35)" } : {}),
        ...style,
      }}
      onClick={handleCopy}
    >
      {copied
        ? <><CheckIcon style={{ width: iconSize, height: iconSize }} /> Copied!</>
        : <><DocumentDuplicateIcon style={{ width: iconSize, height: iconSize }} /> {label}</>
      }
    </button>
  );
}
