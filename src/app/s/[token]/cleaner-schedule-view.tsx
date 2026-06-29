"use client";

import { useMemo, useState } from "react";

export type CalOccupant = {
  room_number: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: "current" | "vacated" | "upcoming";
};

export type CalCleaning = {
  id: string;
  date: string; // ISO YYYY-MM-DD
  unitLabel: string;
  isMoveOut: boolean;
  roomLabel: string | null;
  notes: string | null;
  leaseholderName: string | null;
  occupants: CalOccupant[];
};

// ---- date helpers (date-only, UTC math so there's no timezone drift) ----
const parse = (iso: string) => new Date(iso + "T00:00:00Z");
const toISO = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
};
const dow = (iso: string) => parse(iso).getUTCDay();
const weekStart = (iso: string) => addDays(iso, -dow(iso));
const startOfMonth = (iso: string) => iso.slice(0, 7) + "-01";
const addMonths = (iso: string, n: number) => {
  const d = parse(iso);
  d.setUTCMonth(d.getUTCMonth() + n);
  return toISO(d);
};
const fmtDate = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${m}/${d}`;
};
const dowName = (iso: string, f: "long" | "short" | "narrow") =>
  parse(iso).toLocaleDateString("en-US", { weekday: f, timeZone: "UTC" });
const monthLabel = (iso: string) =>
  parse(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

type Screen = "calendar" | "day" | "week";

export function CleanerScheduleView({
  cleanerName,
  today,
  cleanings,
}: {
  cleanerName: string | null;
  today: string;
  cleanings: CalCleaning[];
}) {
  const [screen, setScreen] = useState<Screen>("calendar");
  const [monthAnchor, setMonthAnchor] = useState(today);
  const [weekAnchor, setWeekAnchor] = useState(today);
  const [selectedDay, setSelectedDay] = useState(today);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const byDate = useMemo(() => {
    const m = new Map<string, CalCleaning[]>();
    for (const c of cleanings) {
      const arr = m.get(c.date) ?? [];
      arr.push(c);
      m.set(c.date, arr);
    }
    for (const arr of m.values())
      arr.sort((a, b) => a.unitLabel.localeCompare(b.unitLabel));
    return m;
  }, [cleanings]);

  const count = (iso: string) => byDate.get(iso)?.length ?? 0;
  const list = (iso: string) => byDate.get(iso) ?? [];

  // Opening a day expands every one of that day's cards by default.
  const goToDay = (d: string) =>
    setOpenIds(new Set((byDate.get(d) ?? []).map((c) => c.id)));

  const openDay = (d: string) => {
    setSelectedDay(d);
    goToDay(d);
    setScreen("day");
  };

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const firstName = cleanerName?.split(/\s+/)[0] ?? "there";

  return (
    <main className="min-h-screen bg-cream px-4 py-8">
      <div className="mx-auto w-full max-w-xl">
        {screen === "calendar" && (
          <CalendarScreen
            firstName={firstName}
            today={today}
            anchor={monthAnchor}
            setAnchor={setMonthAnchor}
            count={count}
            onPickDay={openDay}
            onWeekly={() => {
              setWeekAnchor(today);
              setScreen("week");
            }}
          />
        )}

        {screen === "week" && (
          <WeekScreen
            anchor={weekAnchor}
            setAnchor={setWeekAnchor}
            today={today}
            count={count}
            onBack={() => setScreen("calendar")}
            onPickDay={openDay}
          />
        )}

        {screen === "day" && (
          <DayScreen
            date={selectedDay}
            items={list(selectedDay)}
            openIds={openIds}
            onToggle={toggle}
            onPrev={() => {
              const nd = addDays(selectedDay, -1);
              setSelectedDay(nd);
              goToDay(nd);
            }}
            onNext={() => {
              const nd = addDays(selectedDay, 1);
              setSelectedDay(nd);
              goToDay(nd);
            }}
            onCalendar={() => setScreen("calendar")}
            onWeekly={() => {
              setWeekAnchor(selectedDay);
              setScreen("week");
            }}
          />
        )}
      </div>
    </main>
  );
}

// ---- shared ----

function Ball({ n, muted }: { n: number; muted?: boolean }) {
  return (
    <span
      className={`inline-flex h-7 min-w-[1.75rem] items-center justify-center rounded-full px-2 text-sm font-semibold ${
        muted ? "bg-warm text-muted" : "bg-accent text-white"
      }`}
    >
      {n}
    </span>
  );
}

function NavBar({
  label,
  onPrev,
  onNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={onPrev}
        aria-label="Previous"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-stone bg-white text-ink hover:bg-warm"
      >
        ‹
      </button>
      <p className="text-base font-semibold text-ink">{label}</p>
      <button
        type="button"
        onClick={onNext}
        aria-label="Next"
        className="flex h-9 w-9 items-center justify-center rounded-full border border-stone bg-white text-ink hover:bg-warm"
      >
        ›
      </button>
    </div>
  );
}

function FootNote() {
  return (
    <div className="mt-6 flex items-start gap-3 rounded-2xl bg-warm/60 px-4 py-3">
      <span className="text-lg text-accent" aria-hidden="true">
        ✦
      </span>
      <p className="text-sm text-muted">
        Tap a date to see that day&apos;s units, tenants and contacts. This page
        always shows your latest schedule.
      </p>
    </div>
  );
}

// ---- Calendar (landing) ----

function CalendarScreen({
  firstName,
  today,
  anchor,
  setAnchor,
  count,
  onPickDay,
  onWeekly,
}: {
  firstName: string;
  today: string;
  anchor: string;
  setAnchor: (s: string) => void;
  count: (s: string) => number;
  onPickDay: (d: string) => void;
  onWeekly: () => void;
}) {
  const first = startOfMonth(anchor);
  const gridStart = weekStart(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const month = anchor.slice(0, 7);

  return (
    <>
      <div className="h-1.5 w-12 rounded-full bg-accent" />
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl leading-none text-ink">
            Hi {firstName},
          </h1>
          <p className="mt-2 text-sm text-muted">Your cleaning schedule.</p>
        </div>
        <button
          type="button"
          onClick={onWeekly}
          className="shrink-0 rounded-xl border border-stone bg-white px-4 py-2.5 text-sm font-medium text-ink shadow-sm hover:bg-warm"
        >
          Weekly view
        </button>
      </div>

      <div className="mt-5">
        <NavBar
          label={monthLabel(anchor)}
          onPrev={() => setAnchor(addMonths(first, -1))}
          onNext={() => setAnchor(addMonths(first, 1))}
        />
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] uppercase tracking-wide text-muted">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((d) => {
            const inMonth = d.slice(0, 7) === month;
            const n = count(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() => onPickDay(d)}
                className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg text-sm transition ${
                  inMonth ? "bg-white text-ink hover:bg-warm" : "bg-transparent text-stone"
                } ${d === today ? "ring-1 ring-accent" : ""}`}
              >
                <span className="leading-none">{Number(d.slice(8, 10))}</span>
                {n > 0 ? (
                  <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
                    {n}
                  </span>
                ) : (
                  <span className="h-4" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <FootNote />
    </>
  );
}

// ---- Weekly grid (the reference layout, counts instead of names, no logos) ----

function WeekScreen({
  anchor,
  setAnchor,
  today,
  count,
  onBack,
  onPickDay,
}: {
  anchor: string;
  setAnchor: (s: string) => void;
  today: string;
  count: (s: string) => number;
  onBack: () => void;
  onPickDay: (d: string) => void;
}) {
  const ws = weekStart(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const we = days[6];

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="text-xs uppercase tracking-wide text-accent-text hover:text-accent-dark"
      >
        ‹ Calendar
      </button>
      <h1 className="mt-3 font-display text-3xl leading-none text-ink">
        Weekly schedule
      </h1>
      <p className="mt-2 mb-4 text-sm text-muted">
        {dowName(ws, "long")} {fmtDate(ws)} – {dowName(we, "long")} {fmtDate(we)}
      </p>

      <NavBar
        label={`${fmtDate(ws)} – ${fmtDate(we)}`}
        onPrev={() => setAnchor(addDays(ws, -7))}
        onNext={() => setAnchor(addDays(ws, 7))}
      />

      <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone/40">
        <div className="grid grid-cols-7 divide-x divide-stone/30">
          {days.map((d) => {
            const n = count(d);
            const isToday = d === today;
            return (
              <button
                key={d}
                type="button"
                disabled={n === 0}
                onClick={() => onPickDay(d)}
                className={`flex flex-col items-center gap-2 px-1 py-4 text-center transition ${
                  n > 0 ? "hover:bg-warm/50" : "cursor-default"
                }`}
              >
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wide ${
                    isToday ? "text-accent-dark" : "text-accent-text"
                  }`}
                >
                  {dowName(d, "short")}
                </span>
                <span className="text-sm font-semibold text-ink">{fmtDate(d)}</span>
                <Ball n={n} muted={n === 0} />
                {n > 0 ? (
                  <span className="text-[10px] font-medium uppercase tracking-wide text-accent-text underline">
                    Details
                  </span>
                ) : (
                  <span className="text-[10px] text-stone">—</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <FootNote />
    </>
  );
}

// ---- Day view ----

function DayScreen({
  date,
  items,
  openIds,
  onToggle,
  onPrev,
  onNext,
  onCalendar,
  onWeekly,
}: {
  date: string;
  items: CalCleaning[];
  openIds: Set<string>;
  onToggle: (id: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onCalendar: () => void;
  onWeekly: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCalendar}
          className="text-xs uppercase tracking-wide text-accent-text hover:text-accent-dark"
        >
          ‹ Calendar
        </button>
        <button
          type="button"
          onClick={onWeekly}
          className="rounded-full border border-stone bg-white px-3 py-1 text-xs font-medium uppercase tracking-wide text-ink hover:bg-warm"
        >
          Weekly view
        </button>
      </div>

      <div className="mt-3">
        <NavBar
          label={`${dowName(date, "long")} ${fmtDate(date)}`}
          onPrev={onPrev}
          onNext={onNext}
        />
      </div>
      <p className="mt-2 mb-4 flex items-center justify-center gap-2 text-sm text-muted">
        <Ball n={items.length} muted={items.length === 0} />
        unit{items.length === 1 ? "" : "s"} to clean
      </p>

      {items.length === 0 ? (
        <p className="rounded-2xl bg-white px-6 py-10 text-center text-muted shadow-sm">
          No cleaning scheduled.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((c) => (
            <UnitCard
              key={c.id}
              c={c}
              open={openIds.has(c.id)}
              onToggle={() => onToggle(c.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function UnitCard({
  c,
  open,
  onToggle,
}: {
  c: CalCleaning;
  open: boolean;
  onToggle: () => void;
}) {
  // Group tenants by room, preserving order (current/vacated first, then upcoming).
  const rooms: { room: string | null; tenants: CalOccupant[] }[] = [];
  for (const o of c.occupants) {
    const last = rooms[rooms.length - 1];
    if (last && last.room === o.room_number) last.tenants.push(o);
    else rooms.push({ room: o.room_number, tenants: [o] });
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-white pl-2 shadow-sm before:absolute before:inset-y-0 before:left-0 before:w-2 ${
        c.isMoveOut ? "before:bg-red-700" : "before:bg-accent"
      }`}
    >
      <button type="button" onClick={onToggle} className="block w-full px-4 pt-4 text-left">
        {c.isMoveOut ? (
          <span className="mb-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700">
            Move-out{c.roomLabel ? ` · ${c.roomLabel}` : ""}
          </span>
        ) : null}
        <p className="text-xl font-semibold tracking-tight text-ink">{c.unitLabel}</p>
      </button>

      <div className="px-4 pb-2 pt-1">
        <p className="text-sm">
          <span className="text-xs uppercase tracking-wide text-muted">
            Lease holder:{" "}
          </span>
          <span className="text-ink">{c.leaseholderName ?? "—"}</span>
        </p>
      </div>

      {open ? (
        <div className="border-t border-stone/40 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Tenants
          </p>
          {rooms.length === 0 ? (
            <p className="mt-2 text-muted">No tenants on record.</p>
          ) : (
            <div className="mt-2">
              {rooms.map((g, i) => (
                <div
                  key={i}
                  className={i > 0 ? "mt-3 border-t border-dashed border-stone/60 pt-3" : ""}
                >
                  <p className="font-medium text-ink">{g.room ?? "Room"}</p>
                  {g.tenants.map((t, j) => (
                    <TenantLines key={j} t={t} />
                  ))}
                </div>
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
      ) : (
        <button
          type="button"
          onClick={onToggle}
          className="w-full px-4 pb-3 text-left text-xs uppercase tracking-wide text-accent-text"
        >
          Show tenants ▾
        </button>
      )}
    </div>
  );
}

function StatusTag({ status }: { status: CalOccupant["status"] }) {
  if (status === "vacated")
    return (
      <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-text">
        Vacated
      </span>
    );
  if (status === "upcoming")
    return (
      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-800">
        Upcoming
      </span>
    );
  return null;
}

function Arrow() {
  return <span className="text-stone">↳ </span>;
}

function TenantLines({ t }: { t: CalOccupant }) {
  const phone = t.phone?.replace(/[^\d+]/g, "");
  return (
    <div className="mt-1.5 pl-3 text-sm">
      <p className="text-ink">
        <Arrow />
        {t.full_name}
        <StatusTag status={t.status} />
      </p>
      <p className="pl-4">
        <Arrow />
        {phone ? (
          <a href={`sms:${phone}`} className="text-accent-text underline">
            {t.phone}
          </a>
        ) : (
          <span className="text-muted">No phone</span>
        )}
      </p>
      <p className="pl-4">
        <Arrow />
        {t.email ? (
          <a href={`mailto:${t.email}`} className="break-all text-accent-text underline">
            {t.email}
          </a>
        ) : (
          <span className="text-muted">No email</span>
        )}
      </p>
    </div>
  );
}
