import type { SalesRecord } from "./salesTracker";

export function totalArr(records: SalesRecord[]): number {
  return records.reduce((sum, r) => sum + (r.arr ?? 0), 0);
}

export function commissionPaid(records: SalesRecord[]): number {
  return records
    .filter((r) => r.payStatus === "1")
    .reduce((sum, r) => sum + (r.value ?? 0), 0);
}

export function commissionAccrued(records: SalesRecord[]): number {
  return records.reduce(
    (sum, r) => sum + Object.values(r.commissions).reduce((s, v) => s + v, 0),
    0
  );
}

/** ARR added per calendar month, based on signDate, most recent 12 months present in the data. */
export function arrByMonth(records: SalesRecord[]) {
  const byMonth = new Map<string, number>();
  for (const r of records) {
    if (!r.signDate || r.arr == null) continue;
    const month = r.signDate.slice(0, 7); // YYYY-MM
    byMonth.set(month, (byMonth.get(month) ?? 0) + r.arr);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, arr]) => ({ month, arr }));
}

export interface CategoryBreakdown {
  category: string;
  arr: number;
  deals: number;
}

export function arrByCategory(records: SalesRecord[]): CategoryBreakdown[] {
  const byCategory = new Map<string, { arr: number; deals: number }>();
  for (const r of records) {
    const key = r.category ?? "Uncategorized";
    const entry = byCategory.get(key) ?? { arr: 0, deals: 0 };
    entry.arr += r.arr ?? 0;
    entry.deals += 1;
    byCategory.set(key, entry);
  }
  return [...byCategory.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.arr - a.arr);
}

export interface RepBreakdown {
  rep: string;
  deals: number;
  arr: number;
  commission: number;
}

export function byRep(records: SalesRecord[]): RepBreakdown[] {
  const reps = new Map<string, { deals: number; arr: number; commission: number }>();
  for (const r of records) {
    const rep = r.closedBy ?? "Unassigned";
    const entry = reps.get(rep) ?? { deals: 0, arr: 0, commission: 0 };
    entry.deals += 1;
    entry.arr += r.arr ?? 0;
    entry.commission += Object.values(r.commissions).reduce((s, v) => s + v, 0);
    reps.set(rep, entry);
  }
  return [...reps.entries()]
    .map(([rep, v]) => ({ rep, ...v }))
    .sort((a, b) => b.arr - a.arr);
}
