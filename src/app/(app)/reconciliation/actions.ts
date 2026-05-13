"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { one } from "@/lib/relations";
import {
  parseBankStatementCsv,
  parseOtherPaymentsBuffer,
  aggregateByDescription,
  unmatchedDescriptions,
} from "@/lib/reconciliation/parsers";

export type RunFormState = { error?: string } | undefined;

function monthBounds(monthIso: string): { start: string; end: string } {
  // monthIso is "YYYY-MM-DD" (always day 01 from the <input type=month> emit + day suffix)
  const [y, m] = monthIso.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export async function runReconciliation(
  _prev: RunFormState,
  formData: FormData,
): Promise<RunFormState> {
  const monthRaw = String(formData.get("month") ?? "").trim();
  // <input type="month"> emits "YYYY-MM"; normalise to "YYYY-MM-01".
  const month = /^\d{4}-\d{2}$/.test(monthRaw)
    ? `${monthRaw}-01`
    : monthRaw;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(month)) {
    return { error: "Pick a month for this reconciliation." };
  }

  const bankFile = formData.get("bank_statement");
  const otherFile = formData.get("other_payments");

  if (!(bankFile instanceof File) || bankFile.size === 0) {
    return { error: "Upload the bank statement CSV." };
  }

  const supabase = await createClient();

  // -----------------------------------------------------------
  // 1. Parse both files in-memory.
  // -----------------------------------------------------------
  const bankText = await bankFile.text();
  const bankDeposits = parseBankStatementCsv(bankText);

  let otherDeposits: Awaited<ReturnType<typeof parseOtherPaymentsBuffer>> = [];
  if (otherFile instanceof File && otherFile.size > 0) {
    const buf = await otherFile.arrayBuffer();
    otherDeposits = await parseOtherPaymentsBuffer(otherFile.name, buf);
  }

  const allDeposits = [...bankDeposits, ...otherDeposits];
  const aggregate = aggregateByDescription(allDeposits);

  // -----------------------------------------------------------
  // 2. Snapshot of active tenancies in the selected month.
  //    An "active" tenancy covers the month if start_date <= month_end
  //    AND (end_date IS NULL OR end_date >= month_start).
  // -----------------------------------------------------------
  const { start, end } = monthBounds(month);

  type TenantRel = { id: string; full_name: string; pays_as: string | null };
  type PropertyRel = {
    building_name: string | null;
    street_address: string;
    unit_number: string;
  };
  type RoomRel = {
    room_number: string | null;
    properties: PropertyRel | PropertyRel[] | null;
  };
  type TenancyRow = {
    id: string;
    tenant_id: string;
    monthly_rent: number;
    start_date: string;
    end_date: string | null;
    tenants: TenantRel | TenantRel[] | null;
    rooms: RoomRel | RoomRel[] | null;
  };

  const { data: tenancies, error: tErr } = await supabase
    .from("tenancies")
    .select(
      `id, tenant_id, monthly_rent, start_date, end_date,
       tenants(id, full_name, pays_as),
       rooms(room_number,
             properties(building_name, street_address, unit_number))`,
    )
    .eq("status", "active")
    .lte("start_date", end)
    .or(`end_date.is.null,end_date.gte.${start}`)
    .returns<TenancyRow[]>();

  if (tErr) return { error: tErr.message };
  const tenancyRows = tenancies ?? [];

  // -----------------------------------------------------------
  // 3. Create the run row first so we can attach payments to it.
  // -----------------------------------------------------------
  const { data: runIns, error: runErr } = await supabase
    .from("reconciliation_runs")
    .insert({ month })
    .select("id")
    .single();
  if (runErr || !runIns) {
    return { error: runErr?.message ?? "Failed to create run." };
  }
  const runId = runIns.id;

  // -----------------------------------------------------------
  // 4. Upload source files to storage (keyed by run for cleanup).
  // -----------------------------------------------------------
  const bankPath = `${runId}/bank-${Date.now()}-${bankFile.name.replace(/[^\w.\-]/g, "_")}`;
  await supabase.storage
    .from("reconciliation")
    .upload(bankPath, bankFile, {
      contentType: bankFile.type || "text/csv",
      upsert: false,
    });

  let otherPath: string | null = null;
  if (otherFile instanceof File && otherFile.size > 0) {
    otherPath = `${runId}/other-${Date.now()}-${otherFile.name.replace(/[^\w.\-]/g, "_")}`;
    await supabase.storage
      .from("reconciliation")
      .upload(otherPath, otherFile, {
        contentType: otherFile.type || "application/octet-stream",
        upsert: false,
      });
  }

  // -----------------------------------------------------------
  // 5. Build matches, payments, and unmatched-deposits list.
  // -----------------------------------------------------------
  const claimedKeys = new Set<string>();
  let matchCount = 0;
  let mismatchCount = 0;
  let missingCount = 0;
  let totalExpected = 0;
  let totalActual = 0;

  type MatchRow = {
    run_id: string;
    tenancy_id: string;
    tenant_id: string | null;
    tenant_name: string;
    pays_as: string;
    property_label: string | null;
    room_label: string | null;
    expected_rent: number;
    actual_amount: number;
    difference: number;
    status: "match" | "mismatch" | "missing";
  };
  const matches: MatchRow[] = [];

  type PaymentRow = {
    tenancy_id: string;
    paid_on: string;
    amount: number;
    payment_type: "rent";
    method: string;
    notes: string;
    reconciliation_run_id: string;
  };
  const payments: PaymentRow[] = [];

  for (const t of tenancyRows) {
    const tenant = one(t.tenants);
    if (!tenant) continue;

    const rawKey = (tenant.pays_as ?? tenant.full_name).trim().toLowerCase();
    const expected = Number(t.monthly_rent);
    const actual = aggregate.get(rawKey) ?? 0;
    if (actual > 0) claimedKeys.add(rawKey);

    const difference = actual - expected;
    let status: MatchRow["status"];
    if (actual <= 0) status = "missing";
    else if (Math.abs(difference) < 0.01) status = "match";
    else status = "mismatch";

    totalExpected += expected;
    totalActual += actual;
    if (status === "match") matchCount++;
    else if (status === "mismatch") mismatchCount++;
    else missingCount++;

    const room = one(t.rooms);
    const property = one(room?.properties ?? null);
    const propertyLabel = property
      ? `${property.building_name?.trim() || property.street_address} Apt ${property.unit_number}`
      : null;

    matches.push({
      run_id: runId,
      tenancy_id: t.id,
      tenant_id: tenant.id,
      tenant_name: tenant.full_name,
      pays_as: rawKey,
      property_label: propertyLabel,
      room_label: room?.room_number ?? null,
      expected_rent: expected,
      actual_amount: actual,
      difference,
      status,
    });

    if (actual > 0) {
      payments.push({
        tenancy_id: t.id,
        paid_on: start,
        amount: actual,
        payment_type: "rent",
        method: "Reconciliation",
        notes: `Auto-imported from reconciliation run on ${new Date().toISOString().slice(0, 10)}`,
        reconciliation_run_id: runId,
      });
    }
  }

  // Insert matches
  if (matches.length > 0) {
    const { error: mErr } = await supabase
      .from("reconciliation_matches")
      .insert(matches);
    if (mErr) {
      await supabase.from("reconciliation_runs").delete().eq("id", runId);
      return { error: mErr.message };
    }
  }

  // Insert payments
  if (payments.length > 0) {
    const { error: pErr } = await supabase.from("payments").insert(payments);
    if (pErr) {
      await supabase.from("reconciliation_runs").delete().eq("id", runId);
      return { error: pErr.message };
    }
  }

  // Update run with totals + unmatched deposits
  const unmatched = unmatchedDescriptions(aggregate, claimedKeys);
  await supabase
    .from("reconciliation_runs")
    .update({
      bank_statement_path: bankPath,
      other_payments_path: otherPath,
      total_expected: totalExpected,
      total_actual: totalActual,
      match_count: matchCount,
      mismatch_count: mismatchCount,
      missing_count: missingCount,
      unmatched_deposits: unmatched,
    })
    .eq("id", runId);

  revalidatePath("/reconciliation");
  revalidatePath("/tenants");
  redirect(`/reconciliation/${runId}`);
}

export async function deleteRun(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  // Clear up stored objects under this run's folder.
  const { data: objects } = await supabase.storage
    .from("reconciliation")
    .list(id);
  if (objects && objects.length > 0) {
    await supabase.storage
      .from("reconciliation")
      .remove(objects.map((o) => `${id}/${o.name}`));
  }
  // Cascade deletes the matches; payments.reconciliation_run_id is SET NULL,
  // so the payment rows survive — explicitly remove them so re-running the
  // same month doesn't double-count.
  await supabase
    .from("payments")
    .delete()
    .eq("reconciliation_run_id", id);
  await supabase.from("reconciliation_runs").delete().eq("id", id);
  revalidatePath("/reconciliation");
  redirect("/reconciliation");
}
