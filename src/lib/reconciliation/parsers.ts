// Bank statement + other-payments parsers, ported from
// https://github.com/parth-hive/rent-reconciler/blob/main/src/pages/Index.tsx
// Same matching key (lowercase Description) so existing tenant pays_as values
// keep working.

import Papa from "papaparse";
import ExcelJS from "exceljs";

export type Deposit = {
  description: string;   // lowercased, stripped — matches against tenants.pays_as
  amount: number;
  date: string | null;   // ISO string when known
  raw: string;           // original Description for audit / display
  source: "bank" | "other";
};

const ZELLE_PREFIX_PAID = /^Zelle payment from /i;
const ZELLE_PREFIX_SCHED = /^Zelle Scheduled payment from /i;
const FOR_SUFFIX = / for .*$/i;
const CONF_SUFFIX = / Conf# .*$/i;

function moneyToNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v !== "string") return 0;
  const cleaned = v.replace(/[$,\s]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function cleanZelleName(description: string): string {
  let s = description;
  s = s.replace(ZELLE_PREFIX_SCHED, "");
  s = s.replace(ZELLE_PREFIX_PAID, "");
  s = s.trim();
  s = s.replace(FOR_SUFFIX, "");
  s = s.replace(CONF_SUFFIX, "");
  return s.toLowerCase().trim();
}

function isZelleRow(description: string): boolean {
  return (
    /^Zelle payment from /i.test(description) ||
    /^Zelle Scheduled payment from /i.test(description)
  );
}

/**
 * Bank statement CSV (Bank of America). First 6 lines are a preamble; row 7
 * is the column header. We filter to Zelle deposits only — same as the
 * reconciliation web app — and clean the description into a lowercase match key.
 */
export function parseBankStatementCsv(content: string): Deposit[] {
  const lines = content.replace(/\r/g, "").split("\n");
  if (lines.length < 8) return [];
  const csvText = lines.slice(6).join("\n");

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const out: Deposit[] = [];
  for (const row of parsed.data) {
    const description = String(row["Description"] ?? "").trim();
    if (!isZelleRow(description)) continue;

    const amount = moneyToNumber(row["Amount"]);
    if (amount <= 0) continue;

    out.push({
      description: cleanZelleName(description),
      amount,
      date: String(row["Date"] ?? "") || null,
      raw: description,
      source: "bank",
    });
  }
  return out;
}

/**
 * "Other payments" file — Excel or CSV with at minimum a Description and Amount
 * column. No filtering on type; everything counts.
 */
export async function parseOtherPaymentsBuffer(
  filename: string,
  buffer: ArrayBuffer,
): Promise<Deposit[]> {
  const isExcel = /\.(xlsx|xls)$/i.test(filename);
  let rows: Record<string, unknown>[];

  if (isExcel) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];
    if (!ws) return [];

    let headers: string[] = [];
    rows = [];
    ws.eachRow((row, rowNumber) => {
      const cells = row.values as (ExcelJS.CellValue | undefined)[];
      // ExcelJS arrays are 1-indexed (index 0 is unused).
      const values = cells.slice(1).map((c) => {
        if (c === null || c === undefined) return "";
        if (typeof c === "object" && c !== null && "text" in c) {
          return (c as { text: string }).text;
        }
        if (typeof c === "object" && c !== null && "result" in c) {
          return (c as { result: unknown }).result;
        }
        return c as unknown;
      });

      if (rowNumber === 1) {
        headers = values.map((v) => String(v ?? "").trim());
      } else {
        const r: Record<string, unknown> = {};
        headers.forEach((h, i) => {
          r[h] = values[i];
        });
        rows.push(r);
      }
    });
  } else {
    const text = new TextDecoder("utf-8").decode(buffer);
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    rows = parsed.data as Record<string, unknown>[];
  }

  const out: Deposit[] = [];
  for (const row of rows) {
    const description = String(row["Description"] ?? "").trim();
    if (!description) continue;
    const amount = moneyToNumber(row["Amount"]);
    if (amount <= 0) continue;
    out.push({
      description: description.toLowerCase(),
      amount,
      date: row["Date"] ? String(row["Date"]) : null,
      raw: description,
      source: "other",
    });
  }
  return out;
}

/** Aggregate deposits by their cleaned description (sum amounts). */
export function aggregateByDescription(
  deposits: Deposit[],
): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of deposits) {
    m.set(d.description, (m.get(d.description) ?? 0) + d.amount);
  }
  return m;
}

/** Returns the list of cleaned descriptions in the deposits that no tenant
 *  claimed — useful for the operator to see who paid without a tenant match. */
export function unmatchedDescriptions(
  aggregate: Map<string, number>,
  claimedKeys: Set<string>,
): { description: string; amount: number }[] {
  const out: { description: string; amount: number }[] = [];
  for (const [desc, amount] of aggregate.entries()) {
    if (!claimedKeys.has(desc)) {
      out.push({ description: desc, amount });
    }
  }
  return out.sort((a, b) => b.amount - a.amount);
}
