"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type Action = Database["public"]["Enums"]["listing_action"];
const VALID: Action[] = [
  "new_ad",
  "update_price_or_date",
  "delete_listing",
  "boost_post",
  "priority",
];

export async function setListingAction(roomId: string, action: Action) {
  if (!roomId || !VALID.includes(action)) return;

  const supabase = await createClient();
  await supabase
    .from("rooms")
    .update({ listing_action: action })
    .eq("id", roomId);

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${roomId}`);
}

export type AdFormState = { error?: string } | undefined;

export async function setRoomAd(
  roomId: string,
  _prev: AdFormState,
  formData: FormData,
): Promise<AdFormState> {
  const ad_url = String(formData.get("ad_url") ?? "").trim() || null;
  const ad_boosted = formData.get("ad_boosted") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ ad_url, ad_boosted })
    .eq("id", roomId);

  if (error) return { error: error.message };

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${roomId}`);
  return undefined;
}

export type RentFormState = { error?: string } | undefined;

export async function setRoomRent(
  roomId: string,
  _prev: RentFormState,
  formData: FormData,
): Promise<RentFormState> {
  const baseStr = String(formData.get("base_rent") ?? "").trim();
  const bundleStr = String(formData.get("bundle_fee") ?? "").trim();

  if (!baseStr) return { error: "Base rent is required." };
  const base_rent = Number(baseStr);
  if (!Number.isFinite(base_rent) || base_rent < 0)
    return { error: "Base rent must be a non-negative number." };

  const bundle_fee =
    bundleStr === "" ? null : Number(bundleStr);
  if (bundle_fee !== null && (!Number.isFinite(bundle_fee) || bundle_fee < 0))
    return { error: "Bundle fee must be a non-negative number." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ base_rent, bundle_fee })
    .eq("id", roomId);

  if (error) return { error: error.message };

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${roomId}`);
  return undefined;
}

/**
 * Set the displayed total rent for a room. Computes new base_rent so that
 * base + existing bundle_fee = total. Used by the inline editor on /inventory.
 */
export async function setRoomTotalRent(
  roomId: string,
  total: number,
): Promise<{ ok: true } | { error: string }> {
  if (!Number.isFinite(total) || total < 0) {
    return { error: "Rent must be a non-negative number." };
  }

  const supabase = await createClient();
  const { data: room } = await supabase
    .from("rooms")
    .select("bundle_fee")
    .eq("id", roomId)
    .maybeSingle();
  const bundle = Number(room?.bundle_fee ?? 0);
  const base_rent = Math.max(0, Math.round((total - bundle) * 100) / 100);

  const { error } = await supabase
    .from("rooms")
    .update({ base_rent })
    .eq("id", roomId);

  if (error) return { error: error.message };

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${roomId}`);
  return { ok: true };
}

/** Set rooms.available_from. Pass null/empty to clear. */
export async function setRoomAvailableFrom(
  roomId: string,
  date: string | null,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const value = date === null || date.trim() === "" ? null : date;
  const { error } = await supabase
    .from("rooms")
    .update({ available_from: value })
    .eq("id", roomId);
  if (error) return { error: error.message };
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${roomId}`);
  return { ok: true };
}
