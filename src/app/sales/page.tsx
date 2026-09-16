import { getSalesTracker } from "@/lib/data/salesTracker";
import {
  arrByCategory,
  arrByMonth,
  byRep,
  commissionAccrued,
  commissionPaid,
  totalArr,
} from "@/lib/data/salesMetrics";
import { formatCurrency } from "@/lib/data/metrics";
import { KpiCard } from "@/components/KpiCard";
import { ArrTrendChart } from "@/components/charts/ArrTrendChart";
import { HorizontalBarChart } from "@/components/charts/HorizontalBarChart";

export default function SalesPage() {
  const tracker = getSalesTracker();
  const records = tracker.records;

  const arr = totalArr(records);
  const dealCount = records.length;
  const avgDealArr = dealCount ? arr / dealCount : 0;
  const paid = commissionPaid(records);
  const accrued = commissionAccrued(records);

  const monthly = arrByMonth(records);
  const categories = arrByCategory(records);
  const reps = byRep(records);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold">Sales</h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          {tracker.source} &middot; {dealCount} signed deals &middot; imported{" "}
          {new Date(tracker.importedAt).toLocaleDateString()}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KpiCard label="Total ARR Added" value={formatCurrency(arr)} subtext="All signed deals" />
        <KpiCard label="Deals Signed" value={String(dealCount)} />
        <KpiCard label="Avg Deal ARR" value={formatCurrency(avgDealArr)} />
        <KpiCard label="Commission Paid" value={formatCurrency(paid)} subtext="Pay status = paid" />
        <KpiCard
          label="Commission Accrued"
          value={formatCurrency(accrued)}
          subtext="Owed across all reps, paid + unpaid"
        />
      </div>

      <section className="rounded-xl border border-black/10 dark:border-white/10 p-4">
        <h2 className="text-sm font-semibold mb-2">ARR added by month (sign date)</h2>
        <ArrTrendChart data={monthly} />
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="rounded-xl border border-black/10 dark:border-white/10 p-4">
          <h2 className="text-sm font-semibold mb-2">ARR by customer category</h2>
          <HorizontalBarChart
            data={categories.map((c) => ({ label: c.category, value: c.arr }))}
            valueLabel="ARR"
            color="series3"
          />
        </section>
        <section className="rounded-xl border border-black/10 dark:border-white/10 p-4">
          <h2 className="text-sm font-semibold mb-2">ARR by closer</h2>
          <HorizontalBarChart
            data={reps.map((r) => ({ label: r.rep, value: r.arr }))}
            valueLabel="ARR"
            color="series2"
          />
        </section>
      </div>

      <section className="rounded-xl border border-black/10 dark:border-white/10 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10 bg-black/[.02] dark:bg-white/[.03]">
              <th className="px-3 py-2 text-left font-medium">Closer</th>
              <th className="px-3 py-2 text-right font-medium">Deals</th>
              <th className="px-3 py-2 text-right font-medium">ARR</th>
              <th className="px-3 py-2 text-right font-medium">Commission</th>
            </tr>
          </thead>
          <tbody>
            {reps.map((r) => (
              <tr key={r.rep} className="border-t border-black/5 dark:border-white/5">
                <td className="px-3 py-1.5">{r.rep}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{r.deals}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(r.arr)}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {formatCurrency(r.commission)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
