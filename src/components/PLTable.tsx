import { Fragment } from "react";
import clsx from "clsx";
import type { ReportData } from "@/lib/data/types";
import { formatCurrency } from "@/lib/data/metrics";

const SUMMARY_ROW_ORDER: [string, string][] = [
  ["totalIncome", "Total Income"],
  ["costOfGoodsSold", "Total Cost of Goods Sold"],
  ["grossProfit", "Gross Profit"],
  ["totalExpenses", "Total Expenses"],
  ["netOperatingIncome", "Net Operating Income"],
  ["otherIncome", "Total Other Income"],
  ["otherExpenses", "Total Other Expenses"],
  ["netOtherIncome", "Net Other Income"],
  ["netIncome", "Net Income"],
];

function Cell({ value }: { value: number | null }) {
  if (value == null) return <td className="px-3 py-1.5 text-right text-black/20 dark:text-white/20">&ndash;</td>;
  return (
    <td
      className={clsx(
        "px-3 py-1.5 text-right tabular-nums whitespace-nowrap",
        value < 0 && "text-red-600 dark:text-red-400"
      )}
    >
      {formatCurrency(value)}
    </td>
  );
}

export function PLTable({ report }: { report: ReportData }) {
  const bySection: Record<string, typeof report.rows> = {};
  for (const row of report.rows) {
    const key = row.section ?? "Other";
    (bySection[key] ??= []).push(row);
  }

  const sectionOrder = ["Income", "Cost of Goods Sold", "Expenses", "Other Income", "Other Expenses"];

  return (
    <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-black/10 dark:border-white/10 bg-black/[.02] dark:bg-white/[.03]">
            <th className="px-3 py-2 text-left font-medium sticky left-0 bg-inherit">Account</th>
            {report.periods.map((p) => (
              <th key={p} className="px-3 py-2 text-right font-medium whitespace-nowrap">
                {p}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sectionOrder
            .filter((s) => bySection[s]?.length)
            .map((section) => (
              <Fragment key={section}>
                <tr className="border-t border-black/10 dark:border-white/10">
                  <td
                    colSpan={report.periods.length + 1}
                    className="px-3 py-1.5 font-semibold bg-black/[.02] dark:bg-white/[.03] sticky left-0"
                  >
                    {section}
                  </td>
                </tr>
                {bySection[section].map((row) => (
                  <tr
                    key={`${section}-${row.label}`}
                    className={clsx(
                      "border-t border-black/5 dark:border-white/5",
                      row.isSubtotal && "font-semibold"
                    )}
                  >
                    <td
                      className="px-3 py-1.5 whitespace-nowrap sticky left-0 bg-background"
                      style={{ paddingLeft: `${0.75 + row.depth * 1}rem` }}
                    >
                      {row.displayName}
                    </td>
                    {report.periods.map((p) => (
                      <Cell key={p} value={row.values[p]} />
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          <tr className="border-t-2 border-black/10 dark:border-white/10" />
          {SUMMARY_ROW_ORDER.filter(([key]) => report.summary[key]).map(([key, label]) => (
            <tr key={key} className="border-t border-black/10 dark:border-white/10 font-semibold">
              <td className="px-3 py-1.5 whitespace-nowrap sticky left-0 bg-background">{label}</td>
              {report.periods.map((p) => (
                <Cell key={p} value={report.summary[key][p]} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
