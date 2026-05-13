import type { Database } from "@/lib/supabase/types";

export type Action = Database["public"]["Enums"]["listing_action"];

export const ACTION_LABELS: Record<Action, string> = {
  new_ad: "Create new ad",
  update_price_or_date: "Change price or date",
  delete_listing: "Delete listing",
  boost_post: "Boost post",
  priority: "Priority listing",
};

export const ACTION_ORDER: Action[] = [
  "new_ad",
  "update_price_or_date",
  "boost_post",
  "priority",
  "delete_listing",
];

// Literal class names so Tailwind's compiler picks them up.
export const ACTION_BORDER: Record<Action, string> = {
  new_ad: "border-l-blue-500",
  update_price_or_date: "border-l-yellow-500",
  delete_listing: "border-l-red-500",
  boost_post: "border-l-orange-500",
  priority: "border-l-purple-500",
};

export const ACTION_TINT: Record<Action, string> = {
  new_ad: "bg-blue-50/60",
  update_price_or_date: "bg-yellow-50/60",
  delete_listing: "bg-red-50/60",
  boost_post: "bg-orange-50/60",
  priority: "bg-purple-50/60",
};

export const ACTION_PILL: Record<Action, string> = {
  new_ad: "bg-blue-100 text-blue-900 border-blue-300",
  update_price_or_date: "bg-yellow-100 text-yellow-900 border-yellow-300",
  delete_listing: "bg-red-100 text-red-900 border-red-300",
  boost_post: "bg-orange-100 text-orange-900 border-orange-300",
  priority: "bg-purple-100 text-purple-900 border-purple-300",
};

export const ACTION_SWATCH: Record<Action, string> = {
  new_ad: "bg-blue-500",
  update_price_or_date: "bg-yellow-500",
  delete_listing: "bg-red-500",
  boost_post: "bg-orange-500",
  priority: "bg-purple-500",
};
