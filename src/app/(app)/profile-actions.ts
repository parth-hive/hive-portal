"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type NameFormState = { error?: string; success?: string } | undefined;

export async function setDisplayName(
  _prev: NameFormState,
  formData: FormData,
): Promise<NameFormState> {
  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");

  if (!name) {
    return { error: "Please enter your name." };
  }
  if (name.length < 2) {
    return { error: "Name must be at least 2 characters." };
  }
  if (name.length > 80) {
    return { error: "Name must be 80 characters or fewer." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You are not signed in." };
  }

  // Store on auth user_metadata. `display_name` is what the Supabase
  // dashboard surfaces; mirror to `full_name` for consistency.
  const { error } = await supabase.auth.updateUser({
    data: { display_name: name, full_name: name },
  });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: "Saved." };
}
