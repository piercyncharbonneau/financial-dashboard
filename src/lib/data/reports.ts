import fs from "fs";
import path from "path";
import type { ManifestEntry, ReportData, Basis, Granularity } from "./types";
import { kvGet } from "@/lib/kv";

const SEED_DIR = path.join(process.cwd(), "data", "seed");

/** Cache key used by src/lib/qbo/sync.ts when it writes a live-fetched report. */
export const qboCacheKey = (granularity: "monthly", basis: Basis) => `qbo:pl:${granularity}:${basis}`;

export function getManifest(): ManifestEntry[] {
  const raw = fs.readFileSync(path.join(SEED_DIR, "manifest.json"), "utf-8");
  return JSON.parse(raw);
}

export function getReportById(id: string): ReportData {
  const entry = getManifest().find((m) => m.id === id);
  if (!entry) throw new Error(`No report found with id ${id}`);
  const raw = fs.readFileSync(path.join(SEED_DIR, entry.file), "utf-8");
  return JSON.parse(raw);
}

/**
 * Most recent P&L, preferring a live QuickBooks pull cached by
 * src/lib/qbo/sync.ts over the manually-imported seed file. Only "monthly"
 * is ever live-synced today (see sync.ts) — weekly always comes from the
 * seed data, which is fine until someone builds the weekly sync too.
 */
export async function getLatestProfitAndLoss(
  granularity: Exclude<Granularity, null>,
  basis: Basis
): Promise<ReportData> {
  if (granularity === "monthly") {
    const cached = await kvGet<ReportData>(qboCacheKey("monthly", basis));
    if (cached) return cached;
  }

  const candidates = getManifest()
    .filter(
      (m) =>
        m.reportType === "profit-and-loss" &&
        m.granularity === granularity &&
        m.basis === basis
    )
    .sort((a, b) => b.period.localeCompare(a.period));
  if (candidates.length === 0) {
    throw new Error(`No profit-and-loss report found for ${granularity}/${basis}`);
  }
  return getReportById(candidates[0].id);
}

/**
 * Balance sheet — always from the seed data for now, deliberately not
 * live-synced yet. The QBO Report API's balance sheet group taxonomy
 * wasn't something this code could validate without a real connection to
 * test against, and a wrong cash balance is worse than a stale one — it
 * feeds the cash-on-hand projection directly. See src/lib/qbo/reports.ts.
 */
export function getLatestBalanceSheet(basis: Basis = "accrual"): ReportData {
  const candidates = getManifest()
    .filter((m) => m.reportType === "balance-sheet" && m.basis === basis)
    .sort((a, b) => b.period.localeCompare(a.period));
  if (candidates.length === 0) {
    throw new Error(`No balance-sheet report found for basis ${basis}`);
  }
  return getReportById(candidates[0].id);
}

/** Top-level category rows (depth 1) for a report section, using the Total column when present. */
export function getTopLevelCategories(report: ReportData, section: string) {
  return report.rows.filter((r) => r.section === section && r.depth === 1);
}
