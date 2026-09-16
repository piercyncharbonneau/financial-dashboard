import fs from "fs";
import path from "path";
import type { ManifestEntry, ReportData, Basis, Granularity } from "./types";

const SEED_DIR = path.join(process.cwd(), "data", "seed");

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

/** Most recent P&L export matching the given granularity + basis. */
export function getLatestProfitAndLoss(
  granularity: Exclude<Granularity, null>,
  basis: Basis
): ReportData {
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
