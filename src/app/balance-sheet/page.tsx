import { getLatestBalanceSheet } from "@/lib/data/reports";
import { formatCurrency, rowValue } from "@/lib/data/metrics";
import { KpiCard } from "@/components/KpiCard";
import { BalanceSheetTable } from "@/components/BalanceSheetTable";

export default function BalanceSheetPage() {
  const report = getLatestBalanceSheet("accrual");

  const totalAssets = report.summary.totalAssets?.["Total"] ?? 0;
  const totalLiabilities = report.summary.totalLiabilities?.["Total"] ?? 0;
  const totalEquity = report.summary.totalEquity?.["Total"] ?? 0;
  const currentAssets = report.summary.totalCurrentAssets?.["Total"] ?? 0;
  const currentLiabilities = report.summary.totalCurrentLiabilities?.["Total"] ?? 0;
  const currentRatio = currentLiabilities ? currentAssets / currentLiabilities : null;
  const cash = rowValue(report, "Total for Bank Accounts");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Balance Sheet</h1>
        <p className="text-sm text-black/50 dark:text-white/50">{report.periodLabel}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard label="Total Assets" value={formatCurrency(totalAssets)} />
        <KpiCard label="Total Liabilities" value={formatCurrency(totalLiabilities)} />
        <KpiCard label="Total Equity" value={formatCurrency(totalEquity)} />
        <KpiCard label="Cash on Hand" value={formatCurrency(cash)} />
        <KpiCard
          label="Current Ratio"
          value={currentRatio != null ? currentRatio.toFixed(2) : "–"}
          subtext="Current assets / current liabilities"
        />
      </div>

      <BalanceSheetTable report={report} />
    </div>
  );
}
