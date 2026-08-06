import type { SupabaseClient } from "@supabase/supabase-js";
import { todayISO } from "@/lib/date";
import { updateRoomsWithNotification } from "@/lib/notifications";

/**
 * Finalize scheduled move-outs. This is background work, not a render side
 * effect: the daily service-role cron calls it once and reports the outcome.
 */
export async function processExpiredTenancies(
  supabase: SupabaseClient,
  today: string = todayISO(),
): Promise<{
  activated: number;
  ended: number;
  roomsReleased: number;
  error?: string;
}> {
  const { data: starting, error: startingError } = await supabase
    .from("tenancies")
    .select("id, room_id")
    .eq("status", "upcoming")
    .lte("start_date", today);
  if (startingError) {
    return {
      activated: 0,
      ended: 0,
      roomsReleased: 0,
      error: startingError.message,
    };
  }

  const startingIds = (starting ?? []).map((tenancy) => tenancy.id);
  const startingRoomIds = (starting ?? [])
    .map((tenancy) => tenancy.room_id)
    .filter((id): id is string => Boolean(id));
  if (startingIds.length > 0) {
    const { error: activateError } = await supabase
      .from("tenancies")
      .update({ status: "active" })
      .in("id", startingIds);
    if (activateError) {
      return {
        activated: 0,
        ended: 0,
        roomsReleased: 0,
        error: activateError.message,
      };
    }
    if (startingRoomIds.length > 0) {
      const { error: occupyError } = await updateRoomsWithNotification(
        supabase,
        startingRoomIds,
        { status: "occupied" },
      );
      if (occupyError) {
        return {
          activated: startingIds.length,
          ended: 0,
          roomsReleased: 0,
          error: occupyError.message,
        };
      }
    }
  }

  const { data: expired, error } = await supabase
    .from("tenancies")
    .select("id, room_id")
    .eq("status", "active")
    .lt("move_out_date", today)
    .not("move_out_date", "is", null);
  if (error) {
    return {
      activated: startingIds.length,
      ended: 0,
      roomsReleased: 0,
      error: error.message,
    };
  }
  if (!expired || expired.length === 0) {
    return { activated: startingIds.length, ended: 0, roomsReleased: 0 };
  }

  const ids = expired.map((tenancy) => tenancy.id);
  const roomIds = expired
    .map((tenancy) => tenancy.room_id)
    .filter((id): id is string => Boolean(id));

  const { error: tenancyError } = await supabase
    .from("tenancies")
    .update({ status: "ended" })
    .in("id", ids);
  if (tenancyError) {
    return {
      activated: startingIds.length,
      ended: 0,
      roomsReleased: 0,
      error: tenancyError.message,
    };
  }

  // Back-to-back turnover guard: an ended tenancy's room may already belong
  // to the incoming tenant (activated moments ago in this same run, or added
  // earlier). Releasing it would flip an occupied room back to available, so
  // only rooms with no live tenancy left are released.
  let releasableRoomIds: string[] = [];
  if (roomIds.length > 0) {
    const { data: stillHeld, error: heldError } = await supabase
      .from("tenancies")
      .select("room_id")
      .in("room_id", roomIds)
      .in("status", ["active", "upcoming"]);
    if (heldError) {
      return {
        activated: startingIds.length,
        ended: ids.length,
        roomsReleased: 0,
        error: heldError.message,
      };
    }
    const held = new Set((stillHeld ?? []).map((t) => t.room_id));
    releasableRoomIds = [...new Set(roomIds)].filter((id) => !held.has(id));
  }

  if (releasableRoomIds.length > 0) {
    const { error: roomError } = await updateRoomsWithNotification(
      supabase,
      releasableRoomIds,
      { status: "available", listing_action: "no_action" },
    );
    if (roomError) {
      return {
        activated: startingIds.length,
        ended: ids.length,
        roomsReleased: 0,
        error: roomError.message,
      };
    }
  }

  return {
    activated: startingIds.length,
    ended: ids.length,
    roomsReleased: releasableRoomIds.length,
  };
}
