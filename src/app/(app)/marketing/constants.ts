import type { Database } from "@/lib/supabase/types";

export type Platform = Database["public"]["Enums"]["marketing_platform"];

export const PLATFORM_LABELS: Record<Platform, string> = {
  facebook: "Facebook",
  craigslist: "Craigslist",
  instagram: "Instagram",
  zillow: "Zillow",
  apartments_com: "Apartments.com",
  other: "Other",
};

export const PLATFORM_ORDER: Platform[] = [
  "facebook",
  "craigslist",
  "instagram",
  "zillow",
  "apartments_com",
  "other",
];

export const PLATFORM_PILL: Record<Platform, string> = {
  facebook: "bg-accent/15 text-accent-text",
  craigslist: "bg-warm text-ink/70",
  instagram: "bg-accent/15 text-accent-text",
  zillow: "bg-stone/40 text-ink/70",
  apartments_com: "bg-stone/40 text-ink/70",
  other: "bg-warm text-ink/70",
};
