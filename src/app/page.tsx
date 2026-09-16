import { getLatestBalanceSheet, getLatestProfitAndLoss } from "@/lib/data/reports";
import {
  expenseBreakdown,
  formatCurrency,
  formatPercent,
  marginTrend,
  pctChange,
  rowValue,
  summarySeries,
  summaryTotal,
} from "@/lib/data/metrics";
import { KpiCard } from "@/components/KpiCard";
import { RevenueTrendChart } from "@/components/charts/RevenueTrendChart";
import { NetIncomeTrendChart } from "@/components/charts/NetIncomeTrendChart";
import { MarginTrendChart } from "@/components/charts/MarginTrendChart";
import { ExpenseBreakdownChart } from "@/components/charts/ExpenseBreakdownChart";

export default function OverviewPage() {
  const pl = getLatestProfitAndLoss("monthly", "accrual");
  const balanceSheet = getLatestBalanceSheet("accrual");

  const revenueTotal = summaryTotal(pl, "totalIncome");
  const grossProfitTotal = summaryTotal(pl, "grossProfit");
  const netIncomeTotal = summaryTotal(pl, "netIncome");
  const expensesTotal = summaryTotal(pl, "totalExpenses");
  const cashOnHand = rowValue(balanceSheet, "Total for Bank Accounts");

  const revenueSeries = summarySeries(pl, "totalIncome");
  const netIncomeSeries = summarySeries(pl, "netIncome");
  const lastTwo = revenueSeries.slice(-2);
  const revenueMoM =
    lastTwo.length === 2 ? pctChange(lastTwo[1].value, lastTwo[0].value) : null;
  const netIncomeLastTwo = netIncomeSeries.slice(-2);
  const netIncomeMoM =
    netIncomeLastTwo.length === 2
      ? pctChange(netIncomeLastTwo[1].value, netIncomeLastTwo[0].value)
      : null;

  const margins = marginTrend(pl);
  const grossMarginPct = revenueTotal ? grossProfitTotal / revenueTotal : 0;
  const netMarginPct = revenueTotal ? netIncomeTotal / revenueTotal : 0;
  const opexRatio = revenueTotal ? expensesTotal / revenueTotal : 0;

  const expenses = expenseBreakdown(pl, "Total");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Overview</h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          {pl.periodLabel} &middot; Accrual basis &middot; Balance sheet as of{" "}
          {balanceSheet.periodLabel.replace("As of ", "")}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard
          label="Revenue (YTD)"
          value={formatCurrency(revenueTotal)}
          delta={revenueMoM != null ? `${revenueMoM >= 0 ? "+" : ""}${formatPercent(revenueMoM)} MoM` : undefined}
          deltaTone={revenueMoM == null ? "neutral" : revenueMoM >= 0 ? "positive" : "negative"}
        />
        <KpiCard
          label="Net Income (YTD)"
          value={formatCurrency(netIncomeTotal)}
          delta={netIncomeMoM != null ? `${netIncomeMoM >= 0 ? "+" : ""}${formatPercent(netIncomeMoM)} MoM` : undefined}
          deltaTone={netIncomeMoM == null ? "neutral" : netIncomeMoM >= 0 ? "positive" : "negative"}
        />
        <KpiCard label="Cash on Hand" value={formatCurrency(cashOnHand)} subtext="All bank accounts" />
        <KpiCard label="Gross Margin" value={formatPercent(grossMarginPct)} subtext="YTD" />
        <KpiCard label="Net Margin" value={formatPercent(netMarginPct)} subtext="YTD" />
        <KpiCard label="Operating Expense Ratio" value={formatPercent(opexRatio)} subtext="Opex / Revenue, YTD" />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="rounded-xl border border-black/10 dark:border-white/10 p-4">
          <h2 className="text-sm font-semibold mb-2">Revenue by month</h2>
          <RevenueTrendChart data={revenueSeries.map((d) => ({ period: d.period, revenue: d.value }))} />
        </section>
        <section className="rounded-xl border border-black/10 dark:border-white/10 p-4">
          <h2 className="text-sm font-semibold mb-2">Net income by month</h2>
          <NetIncomeTrendChart data={netIncomeSeries.map((d) => ({ period: d.period, netIncome: d.value }))} />
        </section>
        <section className="rounded-xl border border-black/10 dark:border-white/10 p-4">
          <h2 className="text-sm font-semibold mb-2">Margin trend</h2>
          <MarginTrendChart data={margins} />
        </section>
        <section className="rounded-xl border border-black/10 dark:border-white/10 p-4">
          <h2 className="text-sm font-semibold mb-2">Top expense categories (YTD)</h2>
          <ExpenseBreakdownChart data={expenses} />
        </section>
      </div>
    </div>
  );
}
