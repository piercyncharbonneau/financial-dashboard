import type { ReportData } from "./types";
import type { SalesRecord, SalesTrackerData } from "./salesTracker";

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export interface ForecastMonth {
  period: string; // "Sep 2026"
  monthIndex: number; // 0-11
  year: number;
  isActual: boolean;
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  operatingExpenses: number;
  otherNet: number;
  netIncome: number;
  pipelineContribution: number; // portion of revenue coming from new sales-tracker deals, 0 for actual months
}

export interface ForecastResult {
  months: ForecastMonth[];
  fullYear: {
    revenue: number;
    costOfGoodsSold: number;
    grossProfit: number;
    operatingExpenses: number;
    netIncome: number;
    pipelineContribution: number;
  };
  ytdActual: {
    revenue: number;
    netIncome: number;
    lastActualPeriod: string;
  };
  unscheduledPipelineArr: number; // signed deals with no first-service date yet, not included in month-by-month timing
  methodologyNotes: string[];
}

function parsePeriodLabel(label: string): { monthIndex: number; year: number } {
  const [monStr, yearStr] = label.split(" ");
  const monthIndex = MONTH_NAMES.indexOf(monStr);
  return { monthIndex, year: parseInt(yearStr, 10) };
}

/** Monthly recurring value contributed by sales-tracker deals whose service has
 * started on or before the given (year, monthIndex), restricted to deals that
 * started after the last actual P&L month (so we never double count revenue
 * that's already baked into the historical run-rate). */
function pipelineMonthlyRevenue(
  records: SalesRecord[],
  year: number,
  monthIndex: number,
  cutoffYear: number,
  cutoffMonthIndex: number
): number {
  let total = 0;
  for (const r of records) {
    if (!r.firstServiceDate || r.arr == null) continue;
    const [fsYear, fsMonth] = r.firstServiceDate.split("-").map(Number);
    const fsMonthIndex = fsMonth - 1;
    const startsAfterCutoff =
      fsYear > cutoffYear || (fsYear === cutoffYear && fsMonthIndex > cutoffMonthIndex);
    if (!startsAfterCutoff) continue;
    const hasStartedByTarget =
      fsYear < year || (fsYear === year && fsMonthIndex <= monthIndex);
    if (hasStartedByTarget) total += r.arr / 12;
  }
  return total;
}

export function buildForecast(pl: ReportData, sales: SalesTrackerData): ForecastResult {
  const actualPeriods = pl.periods.filter((p) => p !== "Total");
  const income = pl.summary["totalIncome"] ?? {};
  const cogs = pl.summary["costOfGoodsSold"] ?? {};
  const grossProfit = pl.summary["grossProfit"] ?? {};
  const totalExpenses = pl.summary["totalExpenses"] ?? {};
  const netOtherIncome = pl.summary["netOtherIncome"] ?? {};
  const netIncome = pl.summary["netIncome"] ?? {};

  const lastActualLabel = actualPeriods[actualPeriods.length - 1];
  const { monthIndex: cutoffMonthIndex, year: cutoffYear } = parsePeriodLabel(lastActualLabel);

  const months: ForecastMonth[] = actualPeriods.map((period) => {
    const { monthIndex, year } = parsePeriodLabel(period);
    return {
      period,
      monthIndex,
      year,
      isActual: true,
      revenue: income[period] ?? 0,
      costOfGoodsSold: cogs[period] ?? 0,
      grossProfit: grossProfit[period] ?? 0,
      operatingExpenses: totalExpenses[period] ?? 0,
      otherNet: netOtherIncome[period] ?? 0,
      netIncome: netIncome[period] ?? 0,
      pipelineContribution: 0,
    };
  });

  // Baseline run-rate: average revenue of the trailing 3 actual months.
  const trailing = months.slice(-3);
  const baselineRevenue =
    trailing.reduce((sum, m) => sum + m.revenue, 0) / (trailing.length || 1);

  // Aggregate (sum/sum) ratios from YTD actuals — steadier than averaging monthly ratios.
  const ytdRevenue = months.reduce((s, m) => s + m.revenue, 0);
  const ytdCogs = months.reduce((s, m) => s + m.costOfGoodsSold, 0);
  const cogsRatio = ytdRevenue ? ytdCogs / ytdRevenue : 0;

  // Operating expenses skew fixed (G&A, salaries) — use flat YTD monthly average, not a revenue ratio.
  const avgOpex = months.reduce((s, m) => s + m.operatingExpenses, 0) / (months.length || 1);
  const avgOtherNet = months.reduce((s, m) => s + m.otherNet, 0) / (months.length || 1);

  const records = sales.records;
  const remainingMonths = 11 - cutoffMonthIndex; // months left in the calendar year after the cutoff
  for (let i = 1; i <= remainingMonths; i++) {
    const monthIndex = cutoffMonthIndex + i;
    const year = cutoffYear;
    const pipeline = pipelineMonthlyRevenue(records, year, monthIndex, cutoffYear, cutoffMonthIndex);
    const revenue = baselineRevenue + pipeline;
    const costOfGoodsSold = revenue * cogsRatio;
    const gp = revenue - costOfGoodsSold;
    const ni = gp - avgOpex + avgOtherNet;

    months.push({
      period: `${MONTH_NAMES[monthIndex]} ${year}`,
      monthIndex,
      year,
      isActual: false,
      revenue,
      costOfGoodsSold,
      grossProfit: gp,
      operatingExpenses: avgOpex,
      otherNet: avgOtherNet,
      netIncome: ni,
      pipelineContribution: pipeline,
    });
  }

  const sum = (key: keyof ForecastMonth) =>
    months.reduce((s, m) => s + (m[key] as number), 0);

  const unscheduledPipelineArr = records
    .filter((r) => !r.firstServiceDate && r.signDate && r.arr != null)
    .reduce((s, r) => s + (r.arr ?? 0), 0);

  return {
    months,
    fullYear: {
      revenue: sum("revenue"),
      costOfGoodsSold: sum("costOfGoodsSold"),
      grossProfit: sum("grossProfit"),
      operatingExpenses: sum("operatingExpenses"),
      netIncome: sum("netIncome"),
      pipelineContribution: sum("pipelineContribution"),
    },
    ytdActual: {
      revenue: ytdRevenue,
      netIncome: months.filter((m) => m.isActual).reduce((s, m) => s + m.netIncome, 0),
      lastActualPeriod: lastActualLabel,
    },
    unscheduledPipelineArr,
    methodologyNotes: [
      `Baseline revenue run-rate is the average of the trailing 3 actual months (${trailing.map((m) => m.period).join(", ")}).`,
      "Pipeline uplift adds ARR/12 from Sales Tracker deals whose first-service date falls after the last actual month, starting the month service begins — this avoids double-counting revenue already reflected in actuals.",
      `Cost of Goods Sold is forecast at ${(cogsRatio * 100).toFixed(1)}% of revenue, the YTD aggregate ratio.`,
      `Operating expenses are forecast flat at the YTD monthly average (${avgOpex.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}/mo), since G&A and salaries are largely fixed rather than revenue-scaled.`,
      "This is a straight-line/pipeline blend, not a seasonality model — there isn't enough same-store history yet (this is the first full year of monthly data) to fit a seasonal curve.",
    ],
  };
}
