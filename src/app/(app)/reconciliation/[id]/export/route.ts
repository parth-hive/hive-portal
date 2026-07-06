import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient } from "@/lib/supabase/server";
import { isMaster } from "@/lib/access";

export const dynamic = "force-dynamic";
// Building the workbook scales with match count; lift the ceiling off Vercel's
// default so a large export can't get hard-killed mid-write.
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

type RunRow = {
  id: string;
  month: string;
  total_expected: number | null;
  total_actual: number | null;
};

type MatchRow = {
  tenant_name: string;
  pays_as: string;
  property_label: string | null;
  room_label: string | null;
  expected_rent: number;
  actual_amount: number;
  difference: number;
  status: "match" | "mismatch" | "missing";
  tenants:
    | { email: string | null; phone: string | null }
    | { email: string | null; phone: string | null }[]
    | null;
};

function monthLabel(monthIso: string) {
  const [y, m] = monthIso.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export async function GET(req: Request, context: RouteContext) {
  const { id } = await context.params;
  // ?filter=issues → only mismatched and missing rows (the ones needing
  // follow-up), leaving clean matches out of the sheet.
  const issuesOnly =
    new URL(req.url).searchParams.get("filter") === "issues";

  const supabase = await createClient();
  // The sheet carries the money totals and tenant emails/phones the UI
  // deliberately hides from non-admins — enforce the same rule here.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isMaster(user?.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  const [{ data: run }, { data: matches }] = await Promise.all([
    supabase
      .from("reconciliation_runs")
      .select("id, month, total_expected, total_actual")
      .eq("id", id)
      .maybeSingle<RunRow>(),
    supabase
      .from("reconciliation_matches")
      .select(
        `tenant_name, pays_as, property_label, room_label,
         expected_rent, actual_amount, difference, status,
         tenants(email, phone)`,
      )
      .eq("run_id", id)
      .returns<MatchRow[]>(),
  ]);

  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  const rows = (matches ?? []).filter(
    (m) => !issuesOnly || m.status === "mismatch" || m.status === "missing",
  );

  // Group rows by property_label (sorted by first appearance to mirror the
  // reconciler's grouped-by-apartment output).
  const groupOrder: string[] = [];
  const byGroup = new Map<string, MatchRow[]>();
  for (const m of rows) {
    const key = m.property_label ?? "Unassigned";
    if (!byGroup.has(key)) {
      byGroup.set(key, []);
      groupOrder.push(key);
    }
    byGroup.get(key)!.push(m);
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(
    `Reconciliation ${monthLabel(run.month)}${issuesOnly ? " — issues" : ""}`,
  );

  ws.columns = [
    { header: "#", key: "n", width: 5 },
    { header: "Unit", key: "unit", width: 32 },
    { header: "Room", key: "room", width: 10 },
    { header: "Tenant", key: "tenant", width: 28 },
    { header: "Pays as", key: "pays_as", width: 26 },
    { header: "Email", key: "email", width: 26 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Expected Rent", key: "expected", width: 14 },
    { header: "Actual Paid", key: "actual", width: 14 },
    { header: "Difference", key: "diff", width: 14 },
    { header: "Paid Matches (Y/N)", key: "paid_y_n", width: 12 },
    { header: "Status", key: "status", width: 12 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: "middle" };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF5F2ED" },
  };

  for (const group of groupOrder) {
    const items = byGroup.get(group)!;
    let n = 1;
    for (const m of items) {
      const matched = m.status === "match";
      const tenant = Array.isArray(m.tenants) ? m.tenants[0] : m.tenants;
      const row = ws.addRow({
        n,
        unit: group,
        room: m.room_label ?? "",
        tenant: m.tenant_name,
        pays_as: m.pays_as,
        email: tenant?.email ?? "",
        phone: tenant?.phone ?? "",
        expected: m.expected_rent ?? 0,
        actual: m.actual_amount ?? 0,
        diff: m.difference ?? 0,
        paid_y_n: matched ? "Y" : "N",
        status: m.status,
      });
      row.getCell("expected").numFmt = "$#,##0.00";
      row.getCell("actual").numFmt = "$#,##0.00";
      row.getCell("diff").numFmt = "$#,##0.00";
      const ynCell = row.getCell("paid_y_n");
      ynCell.alignment = { horizontal: "center" };
      ynCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: matched ? "FFD1FAE5" : "FFFEE2E2" },
      };
      ynCell.font = {
        bold: true,
        color: { argb: matched ? "FF065F46" : "FF991B1B" },
      };
      n++;
    }
    // Subtotal row per apartment
    const subtotal = items.reduce(
      (acc, m) => {
        acc.expected += m.expected_rent ?? 0;
        acc.actual += m.actual_amount ?? 0;
        return acc;
      },
      { expected: 0, actual: 0 },
    );
    const sub = ws.addRow({
      unit: `${group} subtotal`,
      expected: subtotal.expected,
      actual: subtotal.actual,
      diff: subtotal.actual - subtotal.expected,
    });
    sub.font = { italic: true };
    sub.getCell("expected").numFmt = "$#,##0.00";
    sub.getCell("actual").numFmt = "$#,##0.00";
    sub.getCell("diff").numFmt = "$#,##0.00";
    ws.addRow({}); // blank spacer
  }

  // Grand totals
  const total = rows.reduce(
    (acc, m) => {
      acc.expected += m.expected_rent ?? 0;
      acc.actual += m.actual_amount ?? 0;
      return acc;
    },
    { expected: 0, actual: 0 },
  );
  const totalRow = ws.addRow({
    unit: "TOTAL",
    expected: total.expected,
    actual: total.actual,
    diff: total.actual - total.expected,
  });
  totalRow.font = { bold: true };
  totalRow.getCell("expected").numFmt = "$#,##0.00";
  totalRow.getCell("actual").numFmt = "$#,##0.00";
  totalRow.getCell("diff").numFmt = "$#,##0.00";

  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  const monthSlug = run.month.slice(0, 7);
  const filename = `reconciliation-${monthSlug}${issuesOnly ? "-issues" : ""}.xlsx`;
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
