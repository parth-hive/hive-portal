"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { uploadStatement } from "./actions";

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";

type QueueItem = {
  name: string;
  status: "waiting" | "processing" | "done" | "failed";
  detail?: string;
};

export function UploadForm() {
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Process every dropped file sequentially: one extraction per server-action
  // call, so a single bad statement fails alone and never times out the rest.
  async function processAll(files: File[]) {
    if (files.length === 0) return;
    setBusy(true);
    setQueue(files.map((f) => ({ name: f.name, status: "waiting" })));

    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      setQueue((q) =>
        q.map((item, idx) => (idx === i ? { ...item, status: "processing" } : item)),
      );
      const fd = new FormData();
      fd.set("statement", files[i]);
      let result: Awaited<ReturnType<typeof uploadStatement>>;
      try {
        result = await uploadStatement(undefined, fd);
      } catch {
        result = { error: "Upload failed — try again." };
      }
      if (result?.warning) toast.warning(`${files[i].name}: ${result.warning}`);
      setQueue((q) =>
        q.map((item, idx) =>
          idx === i
            ? {
                ...item,
                status: result?.error ? "failed" : "done",
                detail: result?.error ?? result?.success,
              }
            : item,
        ),
      );
      if (!result?.error) ok++;
    }

    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (files.length > 1) {
      const failed = files.length - ok;
      if (failed === 0) toast.success(`All ${files.length} statements logged.`);
      else toast.error(`${ok} of ${files.length} logged — ${failed} failed (see list).`);
    }
    // Clear the finished list after a beat unless something failed — failures
    // stay visible with their error text until the next batch.
    setTimeout(() => setQueue((q) => (q.some((i) => i.status === "failed") ? q : [])), 6000);
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) processAll(Array.from(e.dataTransfer.files ?? []));
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-white px-6 py-12 text-center shadow-sm transition ${
          dragging ? "border-accent bg-accent/5" : "border-stone hover:border-accent/60"
        } ${busy ? "pointer-events-none opacity-70" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          disabled={busy}
          onChange={(e) => processAll(Array.from(e.target.files ?? []))}
        />
        {busy ? (
          <>
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-stone border-t-accent" />
            <p className="text-sm text-ink">
              Processing {queue.filter((i) => i.status !== "waiting").length} of{" "}
              {queue.length} statement{queue.length === 1 ? "" : "s"}…
            </p>
            <p className="text-xs text-muted">
              Each statement takes a few seconds to read.
            </p>
          </>
        ) : (
          <>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </span>
            <p className="text-sm font-medium text-ink">
              Drop utility statements here, or click to browse
            </p>
            <p className="text-xs text-muted">
              PDFs or photos — several at once is fine. Any unit, any month, up
              to 20 MB each.
            </p>
          </>
        )}
      </label>

      {queue.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {queue.map((item, i) => (
            <li
              key={`${item.name}-${i}`}
              className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs shadow-sm"
            >
              <span className="w-4 text-center">
                {item.status === "waiting" && <span className="text-muted">•</span>}
                {item.status === "processing" && (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border border-stone border-t-accent align-middle" />
                )}
                {item.status === "done" && <span className="text-emerald-700">✓</span>}
                {item.status === "failed" && <span className="text-red-700">✕</span>}
              </span>
              <span className="shrink-0 font-medium text-ink">{item.name}</span>
              {item.detail && (
                <span
                  className={`min-w-0 truncate ${
                    item.status === "failed" ? "text-red-700" : "text-muted"
                  }`}
                  title={item.detail}
                >
                  {item.detail}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
