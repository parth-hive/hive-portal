"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type Platform = Database["public"]["Enums"]["marketing_platform"];
const VALID_PLATFORMS: Platform[] = [
  "facebook",
  "craigslist",
  "instagram",
  "zillow",
  "apartments_com",
  "other",
];

export type ChannelFormState = { error?: string } | undefined;

type ChannelValues = {
  name: string;
  platform: Platform;
  url: string | null;
};

function parseChannel(formData: FormData): ChannelValues | { error: string } {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Channel name is required." };

  const platform = String(formData.get("platform") ?? "facebook") as Platform;
  if (!VALID_PLATFORMS.includes(platform))
    return { error: "Invalid platform." };

  const url = String(formData.get("url") ?? "").trim() || null;

  return { name, platform, url };
}

export async function addChannel(
  _prev: ChannelFormState,
  formData: FormData,
): Promise<ChannelFormState> {
  const parsed = parseChannel(formData);
  if ("error" in parsed) return parsed;

  const supabase = await createClient();
  const { error } = await supabase
    .from("marketing_channels")
    .insert(parsed);

  if (error) return { error: error.message };

  revalidatePath("/marketing");
  return undefined;
}

export async function updateChannel(
  id: string,
  _prev: ChannelFormState,
  formData: FormData,
): Promise<ChannelFormState> {
  const parsed = parseChannel(formData);
  if ("error" in parsed) return parsed;

  const supabase = await createClient();
  const { error } = await supabase
    .from("marketing_channels")
    .update(parsed)
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/marketing");
  return undefined;
}

export async function deleteChannel(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("marketing_channels").delete().eq("id", id);
  revalidatePath("/marketing");
}
