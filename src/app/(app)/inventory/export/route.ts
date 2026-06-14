import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import { todayISO } from "@/lib/date";

export const dynamic = "force-dynamic";

type PropertyRel = {
  cross_street: string | null;
  neighborhood: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  has_gym: boolean;
  has_elevator: boolean;
  has_parking: boolean;
  has_doorman: boolean;
  has_rooftop: boolean;
  has_lounge: boolean;
  laundry_in_building: boolean;
  in_unit_laundry: boolean;
};

type Row = {
  id: string;
  status: "occupied" | "available" | "reserved" | "maintenance";
  available_from: string | null;
  base_rent: number | null;
  bundle_fee: number | null;
  total_rent: number | null;
  photos_url: string | null;
  has_ac: boolean;
  has_private_bathroom: boolean;
  properties: PropertyRel | PropertyRel[] | null;
};

function prettyDate(iso: string | null): string {
  if (!iso) return "Available now";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function amenitiesFor(room: Row, p: PropertyRel | null): string {
  const tags: string[] = [];
  if (room.has_ac) tags.push("AC");
  if (room.has_private_bathroom) tags.push("Private bath");
  if (p?.has_gym) tags.push("Gym");
  if (p?.has_elevator) tags.push("Elevator");
  if (p?.has_doorman) tags.push("Doorman");
  if (p?.has_parking) tags.push("Parking");
  if (p?.has_rooftop) tags.push("Rooftop");
  if (p?.has_lounge) tags.push("Lounge");
  if (p?.in_unit_laundry) tags.push("In-unit laundry");
  else if (p?.laundry_in_building) tags.push("Laundry");
  return tags.join(", ");
}

export async function GET() {
  const supabase = await createClient();
  const today = todayISO();

  const { data } = await supabase
    .from("rooms")
    .select(
      `id, status, available_from, base_rent, bundle_fee, total_rent,
       photos_url, has_ac, has_private_bathroom,
       properties(cross_street, neighborhood, bedrooms, bathrooms,
                  has_gym, has_elevator, has_parking, has_doorman, has_rooftop,
                  has_lounge, laundry_in_building, in_unit_laundry)`,
    )
    .or(
      `status.eq.available,and(status.eq.occupied,available_from.gte.${today})`,
    )
    .eq("pending_tenant", false)
    .order("available_from", { ascending: true, nullsFirst: true })
    .returns<Row[]>();

  const rooms = data ?? [];

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Inventory");

  ws.columns = [
    { header: "Cross Street", key: "cross_street", width: 26 },
    { header: "Neighborhood", key: "neighborhood", width: 18 },
    { header: "Photos", key: "photos", width: 12 },
    { header: "Availability", key: "availability", width: 16 },
    { header: "Rent", key: "rent", width: 12 },
    { header: "Services", key: "services", width: 12 },
    { header: "Total", key: "total", width: 12 },
    { header: "Amenities", key: "amenities", width: 40 },
    { header: "Bedrooms", key: "bedrooms", width: 12 },
    { header: "Bathrooms", key: "bathrooms", width: 12 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const r of rooms) {
    const p = one(r.properties);
    const row = ws.addRow({
      cross_street: p?.cross_street ?? "",
      neighborhood: p?.neighborhood ?? "",
      // Show "Link" text hyperlinked to the actual photos URL.
      photos: r.photos_url ? { text: "Link", hyperlink: r.photos_url } : "",
      availability: prettyDate(r.available_from),
      rent: r.base_rent ?? null,
      services: r.bundle_fee ?? null,
      total: r.total_rent ?? null,
      amenities: amenitiesFor(r, p),
      bedrooms: p?.bedrooms ?? null,
      bathrooms: p?.bathrooms ?? null,
    });
    if (r.photos_url) {
      row.getCell("photos").font = {
        color: { argb: "FF0563C1" },
        underline: true,
      };
    }
  }

  for (const key of ["rent", "services", "total"] as const) {
    ws.getColumn(key).numFmt = "$#,##0";
  }
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="hive-inventory-${today}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
