import type { Database } from "@/lib/supabase/types";

type Category = Database["public"]["Enums"]["credential_category"];

export const CATEGORY_LABELS: Record<Category, string> = {
  payment_portal: "Payment portal",
  maintenance_portal: "Maintenance portal",
  utility: "Utility",
  internet: "Internet",
  building_login: "Building login",
  tool_login: "Tool login",
  marketing: "Marketing",
  other: "Other",
};

export const CATEGORY_ORDER: Category[] = [
  "payment_portal",
  "maintenance_portal",
  "utility",
  "internet",
  "building_login",
  "tool_login",
  "marketing",
  "other",
];

export type PropertyOption = {
  id: string;
  label: string;
};
