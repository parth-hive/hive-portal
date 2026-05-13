import { createClient } from "@/lib/supabase/server";
import { AddChannel } from "./add-channel";
import { ChannelRow, type ChannelRowData } from "./channel-row";
import {
  PLATFORM_LABELS,
  PLATFORM_ORDER,
  type Platform,
} from "./constants";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("marketing_channels")
    .select("id, name, platform, url")
    .order("name", { ascending: true })
    .returns<ChannelRowData[]>();

  const channels = data ?? [];

  const grouped = new Map<Platform, ChannelRowData[]>();
  for (const p of PLATFORM_ORDER) grouped.set(p, []);
  for (const c of channels) grouped.get(c.platform)?.push(c);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-stone/60 pb-6">
        <div>
          <h1 className="text-3xl tracking-tight text-ink">
            <span className="font-display text-accent-text">Marketing</span>
          </h1>
          <p className="mt-1 text-sm text-muted">
            Channels where you list vacancies.
          </p>
        </div>
        <AddChannel />
      </header>

      {error && <p className="mt-6 text-sm text-red-700">{error.message}</p>}

      {channels.length === 0 && (
        <p className="mt-10 rounded-2xl bg-white px-6 py-12 text-center text-sm text-muted shadow-sm">
          No channels yet. Click <em>Add channel</em> to enter your first
          Facebook group, Craigslist account, etc.
        </p>
      )}

      {PLATFORM_ORDER.map((p) => {
        const items = grouped.get(p) ?? [];
        if (items.length === 0) return null;
        return (
          <section key={p} className="mt-10">
            <h2 className="text-xs uppercase tracking-wide text-muted">
              {PLATFORM_LABELS[p]} ({items.length})
            </h2>
            <ul className="mt-3 flex flex-col gap-3">
              {items.map((c) => (
                <ChannelRow key={c.id} channel={c} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
