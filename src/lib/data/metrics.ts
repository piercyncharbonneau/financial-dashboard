import type { ReportData } from "./types";

const dataPeriods = (report: ReportData) => report.periods.filter((p) => p !== "Total");

export function summarySeries(report: ReportData, key: string) {
  const row = report.summary[key] ?? {};
  return dataPeriods(report).map((period) => ({
    period,
    value: row[period] ?? 0,
  }));
}

export function summaryTotal(report: ReportData, key: string): number {
  return report.summary[key]?.["Total"] ?? 0;
}

export function findRow(report: ReportData, label: string) {
  return report.rows.find((r) => r.label === label);
}

export function rowValue(report: ReportData, label: string, period = "Total"): number {
  const row = findRow(report, label);
  return row?.values[period] ?? 0;
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

export function marginTrend(report: ReportData) {
  const income = report.summary["totalIncome"] ?? {};
  const grossProfit = report.summary["grossProfit"] ?? {};
  const netIncome = report.summary["netIncome"] ?? {};
  return dataPeriods(report).map((period) => {
    const inc = income[period] ?? 0;
    return {
      period,
      revenue: inc,
      grossMarginPct: inc ? (grossProfit[period] ?? 0) / inc : 0,
      netMarginPct: inc ? (netIncome[period] ?? 0) / inc : 0,
      netIncome: netIncome[period] ?? 0,
    };
  });
}

export interface ExpenseCategory {
  label: string;
  displayName: string;
  section: string;
  amount: number;
}

/** Top-level (depth 1) category rows within COGS + Expenses, for a given period (default Total). */
export function expenseBreakdown(report: ReportData, period = "Total"): ExpenseCategory[] {
  return report.rows
    .filter(
      (r) =>
        r.depth === 1 &&
        (r.section === "Cost of Goods Sold" || r.section === "Expenses") &&
        r.values[period] != null &&
        r.values[period] !== 0
    )
    .map((r) => ({
      label: r.label,
      displayName: r.displayName,
      section: r.section!,
      amount: Math.abs(r.values[period] ?? 0),
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}
