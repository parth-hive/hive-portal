"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { updateRoomsWithNotification } from "@/lib/notifications";

type Action = Database["public"]["Enums"]["listing_action"];
const VALID: Action[] = [
  "no_action",
  "update_price_or_date",
  "delete_listing",
  "boost_post",
  "priority",
];

export async function setListingAction(roomId: string, action: Action) {
  if (!roomId || !VALID.includes(action)) return;

  const supabase = await createClient();
  await updateRoomsWithNotification(supabase, roomId, {
    listing_action: action,
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${roomId}`);
}

export type AdFormState = { error?: string } | undefined;

// A room can carry several ads, each posted by a different person. Every ad is
// its own room_ads row, snapshotting who saved it (display name, else email), so
// the inventory poster tally counts each ad independently.
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function currentPosterName(
  supabase: SupabaseServerClient,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meta = user?.user_metadata ?? {};
  const name =
    typeof meta.display_name === "string" && meta.display_name.trim()
      ? meta.display_name.trim()
      : typeof meta.full_name === "string" && meta.full_name.trim()
        ? meta.full_name.trim()
        : null;
  return name ?? user?.email ?? null;
}

/** Add an ad URL to a room (form version — used on the room detail page). */
export async function setRoomAd(
  roomId: string,
  _prev: AdFormState,
  formData: FormData,
): Promise<AdFormState> {
  const url = String(formData.get("ad_url") ?? "").trim();
  if (!url) return { error: "Enter an ad URL." };
  return addRoomAd(roomId, url);
}

/** Add an ad URL to a room. Multiple people can each add their own. */
export async function addRoomAd(
  roomId: string,
  url: string,
): Promise<{ error?: string } | undefined> {
  const ad_url = url.trim();
  if (!ad_url) return { error: "Enter an ad URL." };

  const supabase = await createClient();
  const posted_by = await currentPosterName(supabase);

  // room_ads post-dates the generated types — access it untyped (project
  // convention for new tables).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("room_ads")
    .insert({ room_id: roomId, url: ad_url, posted_by });

  if (error) return { error: error.message };

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${roomId}`);
  return undefined;
}

/** Remove a single ad from a room. */
export async function deleteRoomAd(
  adId: string,
  roomId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("room_ads")
    .delete()
    .eq("id", adId);

  if (error) return { error: error.message };

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${roomId}`);
  return { ok: true };
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

/** Edit the photos folder URL inline from the inventory table. */
export async function setRoomPhotosUrl(
  roomId: string,
  url: string | null,
): Promise<{ ok: true } | { error: string }> {
  const value = url && url.trim() ? url.trim() : null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ photos_url: value })
    .eq("id", roomId);
  if (error) return { error: error.message };
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${roomId}`);
  return { ok: true };
}

export type AmenityValues = {
  // Room-level (rooms table)
  has_private_bathroom: boolean;
  // Building-level (properties table — applies to every room in the unit)
  has_gym: boolean;
  has_elevator: boolean;
  has_parking: boolean;
  has_doorman: boolean;
  has_rooftop: boolean;
  has_lounge: boolean;
  laundry_in_building: boolean;
  in_unit_laundry: boolean;
};

/**
 * Edit a room's amenities inline. Room-level flags save to the room; building
 * amenities save to the parent property (and thus apply to all of its rooms).
 */
export async function setRoomAmenities(
  roomId: string,
  propertyId: string | null,
  a: AmenityValues,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();

  const { error: roomErr } = await supabase
    .from("rooms")
    .update({
      has_private_bathroom: a.has_private_bathroom,
    })
    .eq("id", roomId);
  if (roomErr) return { error: roomErr.message };

  if (propertyId) {
    const { error: propErr } = await supabase
      .from("properties")
      .update({
        has_gym: a.has_gym,
        has_elevator: a.has_elevator,
        has_parking: a.has_parking,
        has_doorman: a.has_doorman,
        has_rooftop: a.has_rooftop,
        has_lounge: a.has_lounge,
        laundry_in_building: a.laundry_in_building,
        in_unit_laundry: a.in_unit_laundry,
      })
      .eq("id", propertyId);
    if (propErr) return { error: propErr.message };
    revalidatePath(`/properties/${propertyId}`);
  }

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${roomId}`);
  return { ok: true };
}

/** Edit base_rent inline from the inventory table. */
export async function setRoomBaseRent(
  roomId: string,
  value: number,
): Promise<{ ok: true } | { error: string }> {
  if (!Number.isFinite(value) || value < 0) {
    return { error: "Base rent must be a non-negative number." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ base_rent: value })
    .eq("id", roomId);
  if (error) return { error: error.message };
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${roomId}`);
  return { ok: true };
}

/** Edit services / bundle fee inline from the inventory table. */
export async function setRoomServicesFee(
  roomId: string,
  value: number,
): Promise<{ ok: true } | { error: string }> {
  if (!Number.isFinite(value) || value < 0) {
    return { error: "Services fee must be a non-negative number." };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ bundle_fee: value })
    .eq("id", roomId);
  if (error) return { error: error.message };
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${roomId}`);
  return { ok: true };
}

/**
 * Bring a room that isn't currently listed (reserved / maintenance, or
 * occupied without an active tenancy) into the inventory by marking it
 * available. Optionally schedule a future availability date.
 */
export async function makeRoomAvailable(
  roomId: string,
  availableFrom: string | null,
): Promise<{ ok: true } | { error: string }> {
  const value =
    availableFrom && availableFrom.trim() ? availableFrom.trim() : null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ status: "available", available_from: value })
    .eq("id", roomId);
  if (error) return { error: error.message };
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${roomId}`);
  return { ok: true };
}

/**
 * "Delete" a listing from inventory: flag the room pending_tenant so it drops
 * off the Inventory table and surfaces on the Add Tenant page as a listing to
 * fill. Reversible via restoreListing.
 */
export async function deleteListing(
  roomId: string,
): Promise<{ ok: true } | { error: string }> {
  if (!roomId) return { error: "Missing room." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ pending_tenant: true })
    .eq("id", roomId);
  if (error) return { error: error.message };
  revalidatePath("/inventory");
  revalidatePath("/tenants/new");
  return { ok: true };
}

/** Undo a deleted listing — put the room back into the Inventory table. */
export async function restoreListing(
  roomId: string,
): Promise<{ ok: true } | { error: string }> {
  if (!roomId) return { error: "Missing room." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("rooms")
    .update({ pending_tenant: false })
    .eq("id", roomId);
  if (error) return { error: error.message };
  revalidatePath("/inventory");
  revalidatePath("/tenants/new");
  return { ok: true };
}

/**
 * Cancel a scheduled move-out: the outgoing tenant is staying. Clears the
 * tenancy's move_out_date (keeps it active) and returns the room to occupied
 * with no available_from, so the listing drops off Inventory. Mirror-image of
 * endTenancy.
 */
export async function cancelMoveOut(
  tenancyId: string,
  roomId: string,
): Promise<{ ok: true } | { error: string }> {
  if (!tenancyId || !roomId) return { error: "Missing tenancy or room." };
  const supabase = await createClient();

  const { error: tenancyErr } = await supabase
    .from("tenancies")
    .update({ move_out_date: null, status: "active" })
    .eq("id", tenancyId);
  if (tenancyErr) return { error: tenancyErr.message };

  const { error: roomErr } = await updateRoomsWithNotification(
    supabase,
    roomId,
    {
      status: "occupied",
      available_from: null,
      listing_action: "no_action",
    },
  );
  if (roomErr) return { error: roomErr.message };

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
  // Route through updateRoomsWithNotification so changing the move-out date
  // reschedules the move-out cleaning and emails the unit's cleaners.
  const { error } = await updateRoomsWithNotification(supabase, roomId, {
    available_from: value,
  });
  if (error) return { error: error.message };
  revalidatePath("/inventory");
  revalidatePath(`/inventory/${roomId}`);
  return { ok: true };
}
