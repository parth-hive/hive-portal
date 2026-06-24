import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildInventorySheet } from "@/lib/inventory-sheet";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { buffer, filename } = await buildInventorySheet(supabase);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
