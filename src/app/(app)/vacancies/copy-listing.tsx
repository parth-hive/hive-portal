"use client";

import { useState } from "react";

export function CopyListing({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked; ignore.
    }
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        copy();
      }}
      className={`rounded-full px-3 py-1 text-xs uppercase tracking-wide transition ${
        copied
          ? "bg-accent/20 text-accent-text"
          : "border border-stone bg-white text-ink hover:bg-warm"
      }`}
    >
      {copied ? "Copied" : "Copy listing"}
    </button>
  );
}
