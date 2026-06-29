"use client";

import { useState } from "react";
import { CleanerCalendar, type CalCleaning, type CalOccupant } from "./cleaner-calendar";

// date-only helpers (UTC math, no timezone drift)
const parse = (iso: string) => new Date(iso + "T00:00:00Z");
const toISO = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
};
const dow = (iso: string) => parse(iso).getUTCDay();
const weekStart = (iso: string) => addDays(iso, -dow(iso));
const fmtDate = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${m}/${d}`;
};
const dowName = (iso: string, f: "long" | "short") =>
  parse(iso).toLocaleDateString("en-US", { weekday: f, timeZone: "UTC" });

export function CleanerScheduleView({
  cleanerName,
  today,
  cleanings,
}: {
  cleanerName: string | null;
  today: string;
  cleanings: CalCleaning[];
}) {
  const [mode, setMode] = useState<"week" | "calendar">("week");

  if (mode === "calendar") {
    return (
      <CleanerCalendar
        cleanerName={cleanerName}
        today={today}
        cleanings={cleanings}
        onBack={() => setMode("week")}
      />
    );
  }

  return (
    <WeekGrid
      cleanerName={cleanerName}
      today={today}
      cleanings={cleanings}
      onViewCalendar={() => setMode("calendar")}
    />
  );
}

function WeekGrid({
  cleanerName,
  today,
  cleanings,
  onViewCalendar,
}: {
  cleanerName: string | null;
  today: string;
  cleanings: CalCleaning[];
  onViewCalendar: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const ws = weekStart(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const we = days[6];

  const byDate = new Map<string, CalCleaning[]>();
  for (const c of cleanings) {
    if (c.date < ws || c.date > we) continue;
    const arr = byDate.get(c.date) ?? [];
    arr.push(c);
    byDate.set(c.date, arr);
  }
  for (const arr of byDate.values())
    arr.sort((a, b) => a.unitLabel.localeCompare(b.unitLabel));

  const openCleaning = cleanings.find((c) => c.id === openId) ?? null;
  const firstName = cleanerName?.split(/\s+/)[0] ?? "there";

  return (
    <main className="min-h-screen bg-cream px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <div className="h-1.5 w-12 rounded-full bg-accent" />
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl leading-none text-ink">
              Hi {firstName},
            </h1>
            <p className="mt-2 text-sm text-muted">
              Your cleaning schedule for {dowName(ws, "long")} {fmtDate(ws)} –{" "}
              {dowName(we, "long")} {fmtDate(we)}.
            </p>
          </div>
          <button
            type="button"
            onClick={onViewCalendar}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-stone bg-white px-4 py-2.5 text-sm font-medium text-ink shadow-sm hover:bg-warm"
          >
            <CalendarIcon /> View Calendar
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone/40">
          <div className="grid grid-cols-7 divide-x divide-stone/30">
            {days.map((d) => {
              const items = byDate.get(d) ?? [];
              const isToday = d === today;
              return (
                <div key={d} className="flex flex-col px-1.5 py-4 text-center">
                  <p
                    className={`text-[11px] font-semibold uppercase tracking-wide ${
                      isToday ? "text-accent-dark" : "text-accent-text"
                    }`}
                  >
                    {dowName(d, "short")}
                  </p>
                  <p className="mt-1 text-base font-semibold text-ink">
                    {fmtDate(d)}
                  </p>

                  <div className="mt-4 flex flex-1 flex-col gap-3">
                    {items.length === 0 ? (
                      <p className="text-[11px] leading-snug text-muted">
                        No cleaning scheduled
                      </p>
                    ) : (
                      items.map((c) => (
                        <div key={c.id} className="flex flex-1 flex-col">
                          {c.isMoveOut ? (
                            <span className="mx-auto mb-1 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-700">
                              Move-out
                            </span>
                          ) : null}
                          <p className="text-xs leading-snug text-ink">
                            {c.unitLabel}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setOpenId(openId === c.id ? null : c.id)
                            }
                            className="mt-3 text-[11px] font-medium uppercase tracking-wide text-accent-text underline"
                          >
                            {openId === c.id ? "Hide" : "Details"}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {openCleaning ? (
          <ContactPanel c={openCleaning} onClose={() => setOpenId(null)} />
        ) : null}

        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-warm/60 px-4 py-3">
          <span className="text-lg text-accent" aria-hidden="true">
            ✦
          </span>
          <p className="text-sm text-muted">
            Tap a cleaning to see the unit&apos;s tenants and contacts. This page
            always shows your latest schedule.
          </p>
        </div>
      </div>
    </main>
  );
}

function ContactPanel({ c, onClose }: { c: CalCleaning; onClose: () => void }) {
  return (
    <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">
            {dowName(c.date, "long")} {fmtDate(c.date)}
            {c.isMoveOut ? ` · Move-out${c.roomLabel ? ` · ${c.roomLabel}` : ""}` : ""}
          </p>
          <p className="text-lg font-semibold text-ink">{c.unitLabel}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-muted hover:text-ink"
        >
          ✕
        </button>
      </div>
      <p className="mt-3 text-xs uppercase tracking-wide text-muted">Leaseholder</p>
      <p className="mb-3 text-ink">{c.leaseholderName ?? "—"}</p>
      <p className="text-xs uppercase tracking-wide text-muted">Tenants</p>
      {c.occupants.length === 0 ? (
        <p className="mt-1 text-muted">No tenants on record.</p>
      ) : (
        <div className="mt-1">
          {c.occupants.map((o, i) => (
            <Contact key={i} o={o} />
          ))}
        </div>
      )}
      {c.notes ? (
        <>
          <p className="mt-3 text-xs uppercase tracking-wide text-muted">Notes</p>
          <p className="text-ink">{c.notes}</p>
        </>
      ) : null}
    </div>
  );
}

function Contact({ o }: { o: CalOccupant }) {
  const phone = o.phone?.replace(/[^\d+]/g, "");
  return (
    <div className="border-b border-warm py-2 last:border-b-0">
      <p className="text-ink">
        {o.full_name}
        {o.room_number ? <span className="text-muted"> · {o.room_number}</span> : null}
        {o.vacated ? (
          <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-accent-text">
            Vacated
          </span>
        ) : null}
      </p>
      <p className="mt-0.5 flex flex-wrap gap-x-4 text-sm">
        {phone ? (
          <a href={`tel:${phone}`} className="text-accent-text underline">
            {o.phone}
          </a>
        ) : null}
        {o.email ? (
          <a href={`mailto:${o.email}`} className="break-all text-accent-text underline">
            {o.email}
          </a>
        ) : null}
        {!o.phone && !o.email ? <span className="text-muted">No contact on file</span> : null}
      </p>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
