"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CleaningFormState = { error?: string } | undefined;
export type SaveResult = { error?: string; ok?: boolean } | undefined;

// Inline edit of an upcoming cleaning date. With a record_id it updates (or
// deletes when the date is cleared); without one it inserts a new upcoming row.
export async function saveUpcomingDate(formData: FormData): Promise<SaveResult> {
  const property_id = String(formData.get("property_id") ?? "").trim();
  const record_id = String(formData.get("record_id") ?? "").trim();
  const cleaning_date = String(formData.get("cleaning_date") ?? "").trim();
  const assigned_to =
    String(formData.get("assigned_to") ?? "").trim() || null;
  if (!property_id) return { error: "Missing property." };

  const supabase = await createClient();
  if (!cleaning_date) {
    if (record_id) {
      const { error } = await supabase
        .from("cleaning_records")
        .delete()
        .eq("id", record_id);
      if (error) return { error: error.message };
    }
  } else if (record_id) {
    const { error } = await supabase
      .from("cleaning_records")
      .update({ cleaning_date })
      .eq("id", record_id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("cleaning_records")
      .insert({ property_id, cleaning_date, assigned_to });
    if (error) return { error: error.message };
  }

  revalidatePath("/cleaning");
  revalidatePath(`/properties/${property_id}`);
  return { ok: true };
}

type CleaningValues = {
  property_id: string;
  cleaning_date: string;
  assigned_to: string | null;
  notes: string | null;
};

function parse(formData: FormData): CleaningValues | { error: string } {
  const property_id = String(formData.get("property_id") ?? "").trim();
  const cleaning_date = String(formData.get("cleaning_date") ?? "").trim();
  if (!property_id) return { error: "Pick a property." };
  if (!cleaning_date) return { error: "Cleaning date is required." };

  const strOrNull = (k: string) => {
    const v = String(formData.get(k) ?? "").trim();
    return v === "" ? null : v;
  };

  return {
    property_id,
    cleaning_date,
    assigned_to: strOrNull("assigned_to"),
    notes: strOrNull("notes"),
  };
}

export async function addCleaning(
  _prev: CleaningFormState,
  formData: FormData,
): Promise<CleaningFormState> {
  const parsed = parse(formData);
  if ("error" in parsed) return parsed;

  const supabase = await createClient();
  const { error } = await supabase.from("cleaning_records").insert(parsed);

  if (error) return { error: error.message };

  revalidatePath("/cleaning");
  revalidatePath(`/properties/${parsed.property_id}`);
  return undefined;
}

export async function updateCleaning(
  id: string,
  _prev: CleaningFormState,
  formData: FormData,
): Promise<CleaningFormState> {
  const parsed = parse(formData);
  if ("error" in parsed) return parsed;

  const supabase = await createClient();
  const { error } = await supabase
    .from("cleaning_records")
    .update(parsed)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/cleaning");
  revalidatePath(`/properties/${parsed.property_id}`);
  return undefined;
}

export async function deleteCleaning(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const property_id = String(formData.get("property_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("cleaning_records").delete().eq("id", id);

  revalidatePath("/cleaning");
  if (property_id) revalidatePath(`/properties/${property_id}`);
}
