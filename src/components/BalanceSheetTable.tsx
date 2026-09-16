import clsx from "clsx";
import type { ReportData } from "@/lib/data/types";
import { formatCurrency } from "@/lib/data/metrics";

function Row({ label, value, depth = 0, bold = false }: { label: string; value: number | null; depth?: number; bold?: boolean }) {
  return (
    <tr className={clsx("border-t border-black/5 dark:border-white/5", bold && "font-semibold")}>
      <td className="px-3 py-1.5" style={{ paddingLeft: `${0.75 + depth * 1}rem` }}>
        {label}
      </td>
      <td
        className={clsx(
          "px-3 py-1.5 text-right tabular-nums",
          value != null && value < 0 && "text-red-600 dark:text-red-400"
        )}
      >
        {value == null ? "–" : formatCurrency(value)}
      </td>
    </tr>
  );
}

export function BalanceSheetTable({ report }: { report: ReportData }) {
  const section = (name: string) => report.rows.filter((r) => r.section === name);

  return (
    <div className="overflow-x-auto rounded-xl border border-black/10 dark:border-white/10">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-black/10 dark:border-white/10 bg-black/[.02] dark:bg-white/[.03]">
            <th className="px-3 py-2 text-left font-medium">Account</th>
            <th className="px-3 py-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={2} className="px-3 py-1.5 font-semibold bg-black/[.02] dark:bg-white/[.03]">
              Assets
            </td>
          </tr>
          {section("Assets").map((r) => (
            <Row key={r.label} label={r.displayName} value={r.values["Total"]} depth={r.depth} bold={r.isSubtotal} />
          ))}
          <Row label="Total Assets" value={report.summary.totalAssets?.["Total"] ?? null} bold />

          <tr>
            <td colSpan={2} className="px-3 py-1.5 font-semibold bg-black/[.02] dark:bg-white/[.03]">
              Liabilities &amp; Equity
            </td>
          </tr>
          {section("Liabilities and Equity").map((r) => (
            <Row key={r.label} label={r.displayName} value={r.values["Total"]} depth={r.depth} bold={r.isSubtotal} />
          ))}
          <Row label="Total Liabilities" value={report.summary.totalLiabilities?.["Total"] ?? null} bold />
          <Row label="Total Equity" value={report.summary.totalEquity?.["Total"] ?? null} bold />
          <Row
            label="Total Liabilities and Equity"
            value={report.summary.totalLiabilitiesAndEquity?.["Total"] ?? null}
            bold
          />
        </tbody>
      </table>
    </div>
  );
}
