import { getLatestBalanceSheet, getLatestProfitAndLoss } from "@/lib/data/reports";
import { getSalesTracker } from "@/lib/data/salesTracker";
import { buildForecast } from "@/lib/data/forecast";
import { formatCurrency, formatPercent } from "@/lib/data/metrics";
import { KpiCard } from "@/components/KpiCard";
import { ActualVsForecastChart } from "@/components/charts/ActualVsForecastChart";

export default async function ForecastPage() {
  const plAccrual = await getLatestProfitAndLoss("monthly", "accrual");
  const plCash = await getLatestProfitAndLoss("monthly", "cash");
  const balanceSheet = getLatestBalanceSheet("accrual");
  const sales = getSalesTracker();
  const forecast = buildForecast(plAccrual, plCash, balanceSheet, sales);

  const revenueSeries = forecast.months.map((m) => ({
    period: m.period,
    value: m.revenue,
    isActual: m.isActual,
  }));
  const netIncomeSeries = forecast.months.map((m) => ({
    period: m.period,
    value: m.netIncome,
    isActual: m.isActual,
  }));

  const fyMargin = forecast.fullYear.revenue
    ? forecast.fullYear.netIncome / forecast.fullYear.revenue
    : 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">2026 Forecast</h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          Actuals through {forecast.ytdActual.lastActualPeriod}, projected through Dec 2026
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Projected FY2026 Revenue"
          value={formatCurrency(forecast.fullYear.revenue)}
        />
        <KpiCard
          label="Projected FY2026 Net Income"
          value={formatCurrency(forecast.fullYear.netIncome)}
          subtext={`${formatPercent(fyMargin)} net margin`}
        />
        <KpiCard
          label="YTD Actual Revenue"
          value={formatCurrency(forecast.ytdActual.revenue)}
          subtext={`Through ${forecast.ytdActual.lastActualPeriod}`}
        />
        <KpiCard
          label="Assumed New Business (Sep-Dec)"
          value={formatCurrency(forecast.fullYear.assumedNewBusinessRevenue)}
          subtext="Revenue from deals not yet signed, at recent pace"
        />
      </div>

      {forecast.unscheduledPipelineArr > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <strong>{formatCurrency(forecast.unscheduledPipelineArr)}</strong> of signed ARR isn&apos;t
          in this forecast yet — those deals don&apos;t have a first-service date set in the
          sales tracker, so there&apos;s no month to place them in. Once they start service, this
          forecast will pick them up automatically on refresh.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <section className="rounded-xl border border-black/10 dark:border-white/10 p-4">
          <h2 className="text-sm font-semibold mb-2">Revenue: actual vs. forecast</h2>
          <ActualVsForecastChart data={revenueSeries} seriesLabel="Revenue" color="series1" />
        </section>
        <section className="rounded-xl border border-black/10 dark:border-white/10 p-4">
          <h2 className="text-sm font-semibold mb-2">Net income: actual vs. forecast</h2>
          <ActualVsForecastChart data={netIncomeSeries} seriesLabel="Net income" color="series3" />
        </section>
      </div>

      <section className="rounded-xl border border-black/10 dark:border-white/10 p-4">
        <h2 className="text-sm font-semibold mb-1">Cash on hand projection</h2>
        <p className="text-xs text-black/50 dark:text-white/50 mb-3">
          Starting from the actual bank balance on the balance sheet, rolled forward by projected
          net income. The low/high range reflects how much cash timing has historically swung
          month to month (AR collections, quarterly billings) — treat it as a band, not a point
          estimate, especially for the 1-month figure.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {forecast.cashProjection.map((c) => (
            <div key={c.monthsOut} className="rounded-lg border border-black/10 dark:border-white/10 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
                {c.monthsOut} month{c.monthsOut > 1 ? "s" : ""} out ({c.period})
              </p>
              <p className="text-xl font-semibold tabular-nums mt-1">
                {formatCurrency(c.estimatedCash)}
              </p>
              <p className="text-xs text-black/40 dark:text-white/40 mt-0.5">
                {formatCurrency(c.lowBand)} – {formatCurrency(c.highBand)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-black/10 dark:border-white/10 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10 bg-black/[.02] dark:bg-white/[.03]">
              <th className="px-3 py-2 text-left font-medium">Month</th>
              <th className="px-3 py-2 text-left font-medium"></th>
              <th className="px-3 py-2 text-right font-medium">Revenue</th>
              <th className="px-3 py-2 text-right font-medium">Cost of Goods Sold</th>
              <th className="px-3 py-2 text-right font-medium">Gross Profit</th>
              <th className="px-3 py-2 text-right font-medium">Total Expenses</th>
              <th className="px-3 py-2 text-right font-medium">Net Income</th>
            </tr>
          </thead>
          <tbody>
            {forecast.months.map((m) => (
              <tr key={m.period} className="border-t border-black/5 dark:border-white/5">
                <td className="px-3 py-1.5 whitespace-nowrap">{m.period}</td>
                <td className="px-3 py-1.5">
                  <span
                    className={
                      m.isActual
                        ? "text-xs px-1.5 py-0.5 rounded bg-black/[.06] dark:bg-white/[.08] text-black/50 dark:text-white/50"
                        : "text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    }
                  >
                    {m.isActual ? "Actual" : "Forecast"}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(m.revenue)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {formatCurrency(m.costOfGoodsSold)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {formatCurrency(m.grossProfit)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {formatCurrency(m.totalExpenses)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums font-semibold">
                  {formatCurrency(m.netIncome)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-black/10 dark:border-white/10 font-semibold">
              <td className="px-3 py-1.5">Full Year 2026</td>
              <td className="px-3 py-1.5"></td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {formatCurrency(forecast.fullYear.revenue)}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {formatCurrency(forecast.fullYear.costOfGoodsSold)}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {formatCurrency(forecast.fullYear.grossProfit)}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {formatCurrency(forecast.fullYear.totalExpenses)}
              </td>
              <td className="px-3 py-1.5 text-right tabular-nums">
                {formatCurrency(forecast.fullYear.netIncome)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-black/10 dark:border-white/10 p-4">
        <h2 className="text-sm font-semibold mb-2">Methodology</h2>
        <ul className="text-sm text-black/60 dark:text-white/60 list-disc list-inside space-y-1">
          {forecast.methodologyNotes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
