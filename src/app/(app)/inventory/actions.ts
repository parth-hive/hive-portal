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
