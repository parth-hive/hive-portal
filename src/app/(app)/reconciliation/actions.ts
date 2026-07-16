"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canEditLedger, isMaster, LEDGER_ADMIN_ERROR } from "@/lib/access";
import { one } from "@/lib/relations";
import { todayISO } from "@/lib/date";
import { LEDGER_PAYMENT_CUTOFF } from "@/lib/rent";
import {
  parseBankFile,
  parseOtherFile,
  bankPayerNameDisplay,
  type Deposit,
} from "@/lib/reconciliation/parsers";
import {
  monthBounds,
  loadMonthTenancies,
  loadIgnoredPayerKeys,
  buildMatches,
  recomputeRun,
} from "@/lib/reconciliation/matching";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RunFormState = { error?: string } | undefined;

function invalidPeriodRow(
  rows: Deposit[],
  start: string,
  end: string,
): Deposit | undefined {
  const today = todayISO();
  return rows.find(
    (row) =>
      !row.date || row.date < start || row.date > end || row.date > today,
  );
}

// Store the bank file's negative Zelle rows (chargebacks) as reversal alerts
// on the run, each matched to its best-guess original payment: the most
// recent posted deposit from the same payer for the same amount. Upsert on
// the reversal's own fingerprint, so re-uploading an overlapping statement
// never duplicates an alert (or resurrects a resolved one).
async function saveReversals(
  supabase: SupabaseClient,
  runId: string,
  reversals: Deposit[],
): Promise<void> {
  const insertedIds: string[] = [];
  try {
    for (const rev of reversals) {
      let suspectQuery = supabase
        .from("reconciliation_deposits")
        .select("payment_id")
        .eq("payer_key", rev.description)
        .eq("amount", rev.amount)
        .not("payment_id", "is", null)
        .order("deposit_date", { ascending: false });
      // A reversal can only point backward. Without this bound, a later payment
      // could be selected as the transaction supposedly being reversed.
      if (rev.date) suspectQuery = suspectQuery.lte("deposit_date", rev.date);
      const { data: suspect, error: suspectError } = await suspectQuery
        .limit(1)
        .maybeSingle();
      if (suspectError) throw new Error(suspectError.message);
      const { data: inserted, error } = await supabase
        .from("reconciliation_reversals")
        .upsert(
          {
            run_id: runId,
            external_ref: rev.externalRef,
            payer_key: rev.description,
            raw_description: rev.raw,
            amount: rev.amount,
            deposit_date: rev.date,
            suspect_payment_id: suspect?.payment_id ?? null,
          },
          { onConflict: "external_ref", ignoreDuplicates: true },
        )
        .select("id")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (inserted?.id) insertedIds.push(inserted.id);
    }
  } catch (error) {
    if (insertedIds.length > 0) {
      await supabase.from("reconciliation_reversals").delete().in("id", insertedIds);
    }
    throw error;
  }
}

// ----------------------------------------------------------------------------
// 1. Upload + match → creates a preview run (no payments written yet).
// ----------------------------------------------------------------------------

export async function runReconciliation(
  _prev: RunFormState,
  formData: FormData,
): Promise<RunFormState> {
  const monthRaw = String(formData.get("month") ?? "").trim();
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(monthRaw)
    ? `${monthRaw}-01`
    : monthRaw;
  if (!/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(month)) {
    return { error: "Pick a month for this reconciliation." };
  }
  if (month > `${todayISO().slice(0, 7)}-01`) {
    return { error: "A reconciliation month can't be in the future." };
  }

  const bankFile = formData.get("bank_statement");
  const otherFile = formData.get("other_payments");

  if (!(bankFile instanceof File) || bankFile.size === 0) {
    return { error: "Upload the bank statement file." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!canEditLedger(user?.email)) return { error: LEDGER_ADMIN_ERROR };

  // 1) Parse both files in-memory.
  let bankResult, otherResult;
  try {
    bankResult = await parseBankFile(bankFile);
  } catch (e) {
    return {
      error: `Couldn't read bank file: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  console.log("[recon] bank parse:", {
    name: bankFile.name,
    size: bankFile.size,
    parsedRowCount: bankResult.parsedRowCount,
    deposits: bankResult.deposits.length,
    skipped: bankResult.skipped,
  });

  let allDeposits: Deposit[] = bankResult.deposits;
  if (otherFile instanceof File && otherFile.size > 0) {
    try {
      otherResult = await parseOtherFile(otherFile);
    } catch (e) {
      return {
        error: `Couldn't read other-payments file: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
    console.log("[recon] other parse:", {
      name: otherFile.name,
      size: otherFile.size,
      parsedRowCount: otherResult.parsedRowCount,
      deposits: otherResult.deposits.length,
    });
    allDeposits = [...allDeposits, ...otherResult.deposits];
  }

  const { start, end } = monthBounds(month);
  const badDeposit = invalidPeriodRow(allDeposits, start, end);
  const badReversal = invalidPeriodRow(bankResult.reversals, start, end);
  if (badDeposit || badReversal) {
    const bad = badDeposit ?? badReversal!;
    return {
      error:
        `Every bank row must have a non-future date inside ${month.slice(0, 7)}. ` +
        `Found ${bad.date ?? "a missing date"} in "${bad.raw.slice(0, 80)}".`,
    };
  }

  // Fingerprint hygiene, in two parts:
  // 1) Rows WITH a Conf#: the same confirmation number twice in one export is
  //    the same transaction listed twice — keep the first, drop the rest so
  //    the run's "collected" totals aren't inflated (posting was already
  //    deduped by the unique index, but the display wasn't).
  // 2) Rows WITHOUT a Conf# (synthetic fingerprints): scope by run month and
  //    an occurrence ordinal. Otherwise (a) a dateless file posted in June
  //    collides with the identical row in July's file — July's money would
  //    silently never post — and (b) two identical same-day cash rows in one
  //    file would post once while displaying twice.
  {
    const seenConf = new Set<string>();
    const occurrence = new Map<string, number>();
    const deduped: Deposit[] = [];
    let confDupes = 0;
    for (const d of allDeposits) {
      if (d.externalRef.startsWith("zelle:")) {
        if (seenConf.has(d.externalRef)) {
          confDupes++;
          continue;
        }
        seenConf.add(d.externalRef);
        deduped.push(d);
      } else {
        const n = (occurrence.get(d.externalRef) ?? 0) + 1;
        occurrence.set(d.externalRef, n);
        deduped.push({ ...d, externalRef: `${d.externalRef}:${month}:${n}` });
      }
    }
    allDeposits = deduped;
    if (confDupes > 0) {
      console.log(`[recon] dropped ${confDupes} duplicate Conf# rows`);
    }
  }

  // 2) Snapshot tenancies that overlapped the selected month (including ones
  //    that ended mid-month, whose payments would otherwise go unattributed).
  const { tenancies: tenancyRows, error: tErr } = await loadMonthTenancies(
    supabase,
    start,
    end,
  );
  if (tErr) return { error: `Failed to load tenancies: ${tErr}` };
  console.log("[recon] tenancies loaded:", tenancyRows.length);

  // 3) Create the run (preview state, posted_at = null). Build a diagnostic
  // note so the operator can immediately see what happened.
  const diagnostics =
    `Parsed ${bankResult.parsedRowCount} bank rows → ${bankResult.deposits.length} deposits. ` +
    (otherResult
      ? `Parsed ${otherResult.parsedRowCount} other-file rows → ${otherResult.deposits.length} deposits. `
      : "") +
    `Loaded ${tenancyRows.length} tenancies for month.` +
    (bankResult.skipped.length > 0
      ? ` Bank skipped: ${bankResult.skipped.map((s) => `${s.count} ${s.reason.toLowerCase()}`).join(", ")}.`
      : "");

  const { data: runIns, error: runErr } = await supabase
    .from("reconciliation_runs")
    .insert({ month, notes: diagnostics })
    .select("id")
    .single();
  if (runErr || !runIns) {
    return { error: runErr?.message ?? "Failed to create run." };
  }
  const runId = runIns.id;
  console.log("[recon] run created:", runId);

  // 4) Upload source files to storage. A reconciliation without its source is
  // not auditable, so source persistence is a requirement, not best-effort.
  const safeName = (s: string) => s.replace(/[^\w.\-]/g, "_");
  const bankPath = `${runId}/bank-${Date.now()}-${safeName(bankFile.name)}`;
  {
    const { error: upErr } = await supabase.storage
      .from("reconciliation")
      .upload(bankPath, bankFile, {
        contentType: bankFile.type || "application/octet-stream",
        upsert: false,
      });
    if (upErr) {
      await supabase.from("reconciliation_runs").delete().eq("id", runId);
      return { error: `Failed to preserve the bank statement: ${upErr.message}` };
    }
  }

  let otherPath: string | null = null;
  if (otherFile instanceof File && otherFile.size > 0) {
    otherPath = `${runId}/other-${Date.now()}-${safeName(otherFile.name)}`;
    const { error: upErr } = await supabase.storage
      .from("reconciliation")
      .upload(otherPath, otherFile, {
        contentType: otherFile.type || "application/octet-stream",
        upsert: false,
      });
    if (upErr) {
      await supabase.storage.from("reconciliation").remove([bankPath]);
      await supabase.from("reconciliation_runs").delete().eq("id", runId);
      return { error: `Failed to preserve the other-payments file: ${upErr.message}` };
    }
  }

  // 4b) Flag any negative Zelle rows (chargebacks) for operator review.
  try {
    await saveReversals(supabase, runId, bankResult.reversals);
  } catch (e) {
    await supabase.storage
      .from("reconciliation")
      .remove([bankPath, ...(otherPath ? [otherPath] : [])]);
    await supabase.from("reconciliation_runs").delete().eq("id", runId);
    return {
      error: `Failed to save reversal alerts: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  // 5) Build per-tenant matches (known non-rent payers stay out of the
  //    unmatched list).
  const ignoredKeys = await loadIgnoredPayerKeys(supabase);
  const { matches, tenancyByKey, unmatched, totals } = buildMatches(
    allDeposits,
    tenancyRows,
    start,
    end,
    runId,
    ignoredKeys,
  );

  // 5b) Save every parsed deposit (matched or not) so Post payments can
  //     iterate them and dedupe by external_ref.
  const depositRows = allDeposits.map((d) => ({
    run_id: runId,
    tenancy_id: tenancyByKey.get(d.description) ?? null,
    external_ref: d.externalRef,
    payer_key: d.description,
    raw_description: d.raw,
    amount: d.amount,
    deposit_date: d.date,
  }));
  if (depositRows.length > 0) {
    const { error: dErr } = await supabase
      .from("reconciliation_deposits")
      .insert(depositRows);
    if (dErr) {
      // Deposits are REQUIRED to post — without them Post would silently write
      // nothing yet mark the run "posted". Roll the whole run back instead of
      // leaving a run that looks ready but isn't.
      await supabase.storage
        .from("reconciliation")
        .remove([bankPath, ...(otherPath ? [otherPath] : [])]);
      await supabase.from("reconciliation_runs").delete().eq("id", runId);
      return { error: `Failed to save deposits: ${dErr.message}` };
    }
  }

  const { error: pathError } = await supabase
    .from("reconciliation_runs")
    .update({
      bank_statement_path: bankPath,
      other_payments_path: otherPath,
    })
    .eq("id", runId);
  if (pathError) {
    await supabase.storage
      .from("reconciliation")
      .remove([bankPath, ...(otherPath ? [otherPath] : [])]);
    await supabase.from("reconciliation_runs").delete().eq("id", runId);
    return { error: `Failed to attach source files: ${pathError.message}` };
  }

  // Store matches, assignments, and totals as one snapshot transaction.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: snapshotError } = await (supabase as any).rpc(
    "replace_reconciliation_snapshot",
    {
      p_run_id: runId,
      p_matches: matches,
      p_deposit_assignments: Array.from(
        new Set(allDeposits.map((deposit) => deposit.description)),
      ).map((payerKey) => ({
        payer_key: payerKey,
        tenancy_id: tenancyByKey.get(payerKey) ?? null,
      })),
      p_unmatched: unmatched,
      p_total_expected: totals.totalExpected,
      p_total_actual: totals.totalActual,
      p_match_count: totals.matchCount,
      p_mismatch_count: totals.mismatchCount,
      p_missing_count: totals.missingCount,
      p_post_payments: false,
    },
  );
  if (snapshotError) {
    await supabase.storage
      .from("reconciliation")
      .remove([bankPath, ...(otherPath ? [otherPath] : [])]);
    await supabase.from("reconciliation_runs").delete().eq("id", runId);
    return { error: `Failed to save run snapshot: ${snapshotError.message}` };
  }

  revalidatePath("/reconciliation");
  redirect(`/reconciliation/${runId}`);
}

// ----------------------------------------------------------------------------
// 1b. Add another statement to an existing (unposted) run: parse it, append
//     only the deposits the run doesn't already have, and re-derive matches.
// ----------------------------------------------------------------------------

export type AddStatementState =
  | { error?: string; success?: string }
  | undefined;

export async function addStatementToRun(
  _prev: AddStatementState,
  formData: FormData,
): Promise<AddStatementState> {
  const runId = String(formData.get("run_id") ?? "");
  const file = formData.get("bank_statement");
  if (!runId) return { error: "Missing run id." };
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Upload a statement file." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!canEditLedger(user?.email)) return { error: LEDGER_ADMIN_ERROR };
  const { data: run } = await supabase
    .from("reconciliation_runs")
    .select("id, month, posted_at, notes")
    .eq("id", runId)
    .maybeSingle<{
      id: string;
      month: string;
      posted_at: string | null;
      notes: string | null;
    }>();
  if (!run) return { error: "Run not found." };

  let parsed;
  try {
    parsed = await parseBankFile(file);
  } catch (e) {
    return {
      error: `Couldn't read bank file: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const { start, end } = monthBounds(run.month);
  const badDeposit = invalidPeriodRow(parsed.deposits, start, end);
  const badReversal = invalidPeriodRow(parsed.reversals, start, end);
  if (badDeposit || badReversal) {
    const bad = badDeposit ?? badReversal!;
    return {
      error:
        `Every bank row must have a non-future date inside ${run.month.slice(0, 7)}. ` +
        `Found ${bad.date ?? "a missing date"} in "${bad.raw.slice(0, 80)}".`,
    };
  }

  // Same fingerprint hygiene as run creation, extended across the run:
  // Conf# rows the run already holds (overlapping exports) are skipped, and
  // synthetic month:ordinal refs continue counting from the existing rows so
  // a re-uploaded cash row can't collide with — or shadow — an earlier one.
  const { data: existingDeps } = await supabase
    .from("reconciliation_deposits")
    .select("external_ref")
    .eq("run_id", runId);
  const existingRefs = new Set(
    ((existingDeps ?? []) as { external_ref: string }[]).map(
      (r) => r.external_ref,
    ),
  );
  const occurrence = new Map<string, number>();
  for (const ref of existingRefs) {
    const m = ref.match(/^(.*):(\d{4}-\d{2}-\d{2}):(\d+)$/);
    if (m && m[2] === run.month) {
      occurrence.set(
        m[1],
        Math.max(occurrence.get(m[1]) ?? 0, Number(m[3])),
      );
    }
  }

  const fresh: Deposit[] = [];
  let dupes = 0;
  for (const d of parsed.deposits) {
    if (d.externalRef.startsWith("zelle:")) {
      if (existingRefs.has(d.externalRef)) {
        dupes++;
        continue;
      }
      existingRefs.add(d.externalRef);
      fresh.push(d);
    } else {
      const n = (occurrence.get(d.externalRef) ?? 0) + 1;
      occurrence.set(d.externalRef, n);
      fresh.push({ ...d, externalRef: `${d.externalRef}:${run.month}:${n}` });
    }
  }

  if (fresh.length === 0) {
    return {
      error: `No new deposits — all ${dupes} deposit row${dupes === 1 ? " is" : "s are"} already in this run.`,
    };
  }

  const { error: dErr } = await supabase.from("reconciliation_deposits").insert(
    fresh.map((d) => ({
      run_id: runId,
      tenancy_id: null, // recompute re-points these below
      external_ref: d.externalRef,
      payer_key: d.description,
      raw_description: d.raw,
      amount: d.amount,
      deposit_date: d.date,
    })),
  );
  if (dErr) return { error: `Failed to save deposits: ${dErr.message}` };

  // Audit trail: store the file alongside the run's other sources (the run
  // folder is what Delete cleans up) and note what this upload contributed.
  const safeName = (s: string) => s.replace(/[^\w.\-]/g, "_");
  const path = `${runId}/bank-${Date.now()}-${safeName(file.name)}`;
  const { error: upErr } = await supabase.storage
    .from("reconciliation")
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upErr) {
    await supabase
      .from("reconciliation_deposits")
      .delete()
      .eq("run_id", runId)
      .in(
        "external_ref",
        fresh.map((d) => d.externalRef),
      );
    return { error: `Failed to preserve the added statement: ${upErr.message}` };
  }

  // Flag any negative Zelle rows (chargebacks) in the added statement.
  try {
    await saveReversals(supabase, runId, parsed.reversals);
  } catch (e) {
    await supabase
      .from("reconciliation_deposits")
      .delete()
      .eq("run_id", runId)
      .in(
        "external_ref",
        fresh.map((d) => d.externalRef),
      );
    await supabase.storage.from("reconciliation").remove([path]);
    return {
      error: `Failed to save reversal alerts: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const note =
    `Added ${file.name}: ${parsed.parsedRowCount} rows → ${fresh.length} new deposits` +
    (dupes > 0 ? `, ${dupes} duplicates skipped` : "") +
    (parsed.reversals.length > 0
      ? `, ${parsed.reversals.length} possible reversal(s) flagged`
      : "") +
    ".";
  await supabase
    .from("reconciliation_runs")
    .update({ notes: run.notes ? `${run.notes}\n${note}` : note })
    .eq("id", runId);

  // Fold the new deposits into matches/totals/unmatched. For a posted run the
  // snapshot replacement and ledger repost happen in one transaction.
  try {
    await recomputeRun(supabase, runId, {
      allowPosted: Boolean(run.posted_at),
    });
  } catch (e) {
    return {
      error:
        `Added ${fresh.length} deposit${fresh.length === 1 ? "" : "s"}, but updating the run failed: ` +
        `${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (run.posted_at) revalidatePath("/tenants");

  revalidatePath("/reconciliation");
  revalidatePath(`/reconciliation/${runId}`);
  return {
    success:
      `Added ${fresh.length} deposit${fresh.length === 1 ? "" : "s"}` +
      (dupes > 0 ? ` (${dupes} duplicates skipped)` : "") +
      (run.posted_at ? " and posted the matched ones to the ledger." : "."),
  };
}

// ----------------------------------------------------------------------------
// 2. Post payments: write a payments table row for each matched tenancy.
//    Idempotent — re-posting upserts on external_ref (ON CONFLICT DO NOTHING)
//    and re-links deposits, so it never duplicates. If ANY deposit fails to
//    post, the run is NOT marked posted and the action throws, so the UI can
//    surface the failure instead of falsely reporting success.
// ----------------------------------------------------------------------------

async function postRunCore(supabase: SupabaseClient, runId: string) {
  // The RPC validates every external_ref and posts the entire run in one
  // transaction. It intentionally refuses to "adopt" a conflicting payment.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc("post_reconciliation_run", {
    p_run_id: runId,
  });
  if (error) throw new Error(error.message);
}

export async function postPayments(formData: FormData) {
  const runId = String(formData.get("run_id") ?? "");
  if (!runId) return;
  const supabase = await createClient();
  // Posting writes a month of payments into tenant ledgers — operator-only,
  // same restriction as ledger charges.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!canEditLedger(user?.email)) throw new Error(LEDGER_ADMIN_ERROR);
  await postRunCore(supabase, runId);
  revalidatePath("/reconciliation");
  revalidatePath(`/reconciliation/${runId}`);
  revalidatePath("/tenants");
}

export async function unpostPayments(formData: FormData) {
  const runId = String(formData.get("run_id") ?? "");
  if (!runId) return;

  const supabase = await createClient();
  // Unposting deletes a month of payments from tenant ledgers — operator-only.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!canEditLedger(user?.email)) throw new Error(LEDGER_ADMIN_ERROR);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc(
    "unpost_reconciliation_run",
    { p_run_id: runId },
  );
  if (error) throw new Error(error.message);

  revalidatePath("/reconciliation");
  revalidatePath(`/reconciliation/${runId}`);
  revalidatePath("/tenants");
}

// ----------------------------------------------------------------------------
// 3. Delete a run (and its payments + source files).
// ----------------------------------------------------------------------------

export async function deleteRun(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  // Deleting a run also wipes the payments it posted, so restrict it to the
  // master operator. UI hides the button for everyone else; this is the real
  // enforcement since the action is directly invokable.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isMaster(user?.email)) {
    throw new Error("Only an admin can delete a reconciliation run.");
  }

  // Delete the database run and any exclusively-linked payments atomically.
  // Source-object cleanup happens afterward; a storage failure can leave an
  // inaccessible orphan, but can never leave the ledger half-deleted.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).rpc(
    "delete_reconciliation_run",
    { p_run_id: id },
  );
  if (error) throw new Error(error.message);

  const { data: objects } = await supabase.storage
    .from("reconciliation")
    .list(id);
  if (objects && objects.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("reconciliation")
      .remove(objects.map((o) => `${id}/${o.name}`));
    if (storageError) {
      console.error("[recon] deleted run but source cleanup failed:", storageError);
    }
  }
  revalidatePath("/reconciliation");
  redirect("/reconciliation");
}

// ---------------------------------------------------------------------------
// Bulk manual payments — record rent payments for several tenants at once from
// the Reconciliation tab (for payments outside a bank-statement run). Reads
// every `amount:<tenancy_id>` field; inserts a rent payment for each non-empty,
// positive amount, all dated `paid_on`.
// ---------------------------------------------------------------------------

export type BulkPaymentState = { error?: string; success?: string } | undefined;

export async function recordManualPayments(
  _prev: BulkPaymentState,
  formData: FormData,
): Promise<BulkPaymentState> {
  const paid_on = String(formData.get("paid_on") ?? "").trim();
  if (!paid_on) return { error: "Pick a payment date." };
  // Same date guards as the single-payment form — one shared date governs
  // every row here, so a typo would misdate the whole batch at once.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paid_on))
    return { error: "Payment date must be YYYY-MM-DD." };
  if (paid_on > todayISO())
    return { error: "Payment date can't be in the future." };
  // Rent dated before the ledger cutoff is silently excluded from every
  // balance (pre-ledger months are treated as settled) — recording it would
  // create invisible money, so refuse the batch outright.
  if (paid_on < LEDGER_PAYMENT_CUTOFF)
    return {
      error: `Rent payments must be dated ${LEDGER_PAYMENT_CUTOFF} or later — earlier dates predate the ledger and wouldn't count toward any balance.`,
    };

  const rows: {
    tenancy_id: string;
    paid_on: string;
    amount: number;
    payment_type: "rent";
    method: string;
    notes: string;
  }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("amount:")) continue;
    const raw = String(value).trim();
    if (!raw) continue;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    rows.push({
      tenancy_id: key.slice("amount:".length),
      paid_on,
      amount,
      payment_type: "rent",
      method: "Manual",
      notes: "Manual entry",
    });
  }

  if (rows.length === 0) return { error: "Enter an amount for at least one tenant." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!canEditLedger(user?.email)) return { error: LEDGER_ADMIN_ERROR };
  const { error } = await supabase.from("payments").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/reconciliation");
  revalidatePath("/tenants");
  return {
    success: `Recorded ${rows.length} payment${rows.length === 1 ? "" : "s"}.`,
  };
}

// ---------------------------------------------------------------------------
// H2 — attribute unmatched deposits. Re-derive a run's matches/totals from its
// already-saved deposits against the CURRENT tenancy data, then let the operator
// assign an unmatched deposit to a tenant by recording the bank's payer name as
// that tenant's pays_as alias (so it auto-matches now and forever after).
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Ignore a payer: their deposits are not rent (personal transfers, other
// ventures), so they drop out of every run's unmatched list — remembered
// globally, the mirror image of the assign flow's payer alias. Un-ignore
// brings them back everywhere (runs re-derive on view).
// ---------------------------------------------------------------------------

export type IgnorePayerState = { error?: string; success?: string } | undefined;

export async function ignoreUnmatchedPayer(
  _prev: IgnorePayerState,
  formData: FormData,
): Promise<IgnorePayerState> {
  const runId = String(formData.get("run_id") ?? "");
  const payerKey = String(formData.get("payer_key") ?? "");
  if (!runId || !payerKey) return { error: "Missing payer." };

  const supabase = await createClient();
  // Hiding money from the books is a ledger-level decision — same gate as
  // assigning and posting.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!canEditLedger(user?.email)) return { error: LEDGER_ADMIN_ERROR };

  // Prefer the bank's original casing for display.
  const { data: dep } = await supabase
    .from("reconciliation_deposits")
    .select("raw_description")
    .eq("run_id", runId)
    .eq("payer_key", payerKey)
    .limit(1)
    .maybeSingle<{ raw_description: string | null }>();
  const display = dep?.raw_description
    ? bankPayerNameDisplay(dep.raw_description)
    : payerKey;

  const { error } = await supabase
    .from("ignored_payers")
    .upsert(
      { payer_key: payerKey, display_name: display, created_by: user?.email ?? null },
      { onConflict: "payer_key" },
    );
  if (error) return { error: error.message };

  try {
    await recomputeRun(supabase, runId, { allowPosted: true });
  } catch (e) {
    return {
      error: `Payer was marked not-rent, but the run could not be updated: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  revalidatePath("/reconciliation");
  revalidatePath(`/reconciliation/${runId}`);
  return {
    success: `"${display}" marked not-rent — their deposits stay out of every run.`,
  };
}

export async function unignorePayer(formData: FormData) {
  const payerKey = String(formData.get("payer_key") ?? "");
  const runId = String(formData.get("run_id") ?? "");
  if (!payerKey) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!canEditLedger(user?.email)) throw new Error(LEDGER_ADMIN_ERROR);

  const { error: deleteError } = await supabase
    .from("ignored_payers")
    .delete()
    .eq("payer_key", payerKey);
  if (deleteError) throw new Error(deleteError.message);
  if (runId) {
    try {
      await recomputeRun(supabase, runId, { allowPosted: true });
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : String(e));
    }
    revalidatePath(`/reconciliation/${runId}`);
  }
  revalidatePath("/reconciliation");
}

// ---------------------------------------------------------------------------
// Resolve a reversal alert: record the offsetting refund on the suspect
// payment's tenancy (debiting their ledger), or dismiss it (the reversed
// transfer wasn't rent / was handled elsewhere).
// ---------------------------------------------------------------------------

export type ReversalState = { error?: string; success?: string } | undefined;

export async function resolveReversal(
  _prev: ReversalState,
  formData: FormData,
): Promise<ReversalState> {
  const id = String(formData.get("id") ?? "");
  const mode = String(formData.get("mode") ?? "");
  if (!id || (mode !== "refund" && mode !== "dismiss")) {
    return { error: "Invalid reversal action." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!canEditLedger(user?.email)) return { error: LEDGER_ADMIN_ERROR };

  // The refund payment and alert resolution commit together. The database
  // also verifies any pre-existing external_ref matches amount/date/type.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(
    "resolve_reconciliation_reversal",
    {
      p_reversal_id: id,
      p_mode: mode,
      p_resolved_by: user?.email ?? "unknown",
    },
  );
  if (error) return { error: error.message };
  const result = data as {
    run_id: string;
    amount: number;
    already_resolved: boolean;
  };
  if (result.already_resolved) return { success: "Already resolved." };

  revalidatePath("/reconciliation");
  revalidatePath(`/reconciliation/${result.run_id}`);
  revalidatePath("/tenants");
  return {
    success:
      mode === "refund"
        ? `Refund of $${Number(result.amount).toLocaleString()} recorded — the tenant's ledger now reflects the returned money.`
        : "Reversal dismissed.",
  };
}

export type AssignState = { error?: string; success?: string } | undefined;

export async function assignUnmatchedDeposit(
  _prev: AssignState,
  formData: FormData,
): Promise<AssignState> {
  const runId = String(formData.get("run_id") ?? "");
  const tenancyId = String(formData.get("tenancy_id") ?? "");
  const payerKey = String(formData.get("payer_key") ?? "");
  if (!runId || !tenancyId || !payerKey) {
    return { error: "Pick a tenant to assign this deposit to." };
  }

  const supabase = await createClient();
  // Permanently maps this payer to the tenant and can immediately re-post
  // money on a posted run — operator-only.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!canEditLedger(user?.email)) return { error: LEDGER_ADMIN_ERROR };

  // Resolve the tenant behind the chosen tenancy.
  const { data: ten, error: tErr } = await supabase
    .from("tenancies")
    .select("tenant_id, tenants(full_name)")
    .eq("id", tenancyId)
    .maybeSingle<{
      tenant_id: string;
      tenants: { full_name: string } | { full_name: string }[] | null;
    }>();
  if (tErr || !ten?.tenant_id) {
    return { error: "Couldn't find that tenant." };
  }

  // The bank's printed payer name (original case), kept for display.
  const { data: dep } = await supabase
    .from("reconciliation_deposits")
    .select("raw_description")
    .eq("run_id", runId)
    .eq("payer_key", payerKey)
    .limit(1)
    .maybeSingle<{ raw_description: string | null }>();
  const alias = dep?.raw_description
    ? bankPayerNameDisplay(dep.raw_description)
    : payerKey;

  // Remember the payer → tenant mapping for every future run. Upsert on the
  // payer key so re-assigning a payer simply moves it to the new tenant.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upErr } = await (supabase as any)
    .from("tenant_payer_aliases")
    .upsert(
      {
        tenant_id: ten.tenant_id,
        payer_key: payerKey,
        display_name: alias,
      },
      { onConflict: "payer_key" },
    );
  if (upErr) return { error: `Failed to remember the payer: ${upErr.message}` };

  // Assigning affirms this payer IS rent — clear any stale not-rent flag.
  const { error: clearIgnoredError } = await supabase
    .from("ignored_payers")
    .delete()
    .eq("payer_key", payerKey);
  if (clearIgnoredError) {
    return { error: `Failed to clear the not-rent flag: ${clearIgnoredError.message}` };
  }

  try {
    await recomputeRun(supabase, runId, { allowPosted: true });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  const tenant = one(ten.tenants);
  revalidatePath("/reconciliation");
  revalidatePath(`/reconciliation/${runId}`);
  revalidatePath("/tenants");
  return {
    success: `Assigned to ${tenant?.full_name ?? "tenant"} — "${alias}" will match them automatically in future runs.`,
  };
}
