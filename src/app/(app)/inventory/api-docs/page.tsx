import { redirect } from "next/navigation";

// The docs moved to the public site at /docs/inventory-api; keep the old
// internal URL working for bookmarks.
export default function InventoryApiDocsRedirect() {
  redirect("/docs/inventory-api");
}
