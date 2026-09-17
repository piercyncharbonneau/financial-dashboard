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
  totalExpenses: number;
  otherIncomeNet: number;
  netIncome: number;
  /** Forecast months only: how much of `revenue` is existing signed accounts recurring vs. assumed new business. Both 0 for actual months. */
  signedAccountsRevenue: number;
  assumedNewBusinessRevenue: number;
}

export interface CashProjectionPoint {
  monthsOut: number;
  period: string;
  estimatedCash: number;
  lowBand: number;
  highBand: number;
}

export interface ForecastResult {
  months: ForecastMonth[];
  fullYear: {
    revenue: number;
    costOfGoodsSold: number;
    grossProfit: number;
    totalExpenses: number;
    netIncome: number;
    signedAccountsRevenue: number;
    assumedNewBusinessRevenue: number;
  };
  ytdActual: {
    revenue: number;
    netIncome: number;
    lastActualPeriod: string;
  };
  unscheduledPipelineArr: number;
  cashProjection: CashProjectionPoint[];
  methodologyNotes: string[];
}

function parsePeriodLabel(label: string): { monthIndex: number; year: number } {
  const [monStr, yearStr] = label.split(" ");
  return { monthIndex: MONTH_NAMES.indexOf(monStr), year: parseInt(yearStr, 10) };
}

/** Recurrence interval in months implied by a "times per year" frequency (4 = quarterly -> 3mo, 12 = monthly -> 1mo). */
function intervalMonths(frequencyPerYear: number): number {
  return Math.max(1, Math.round(12 / frequencyPerYear));
}

const absoluteMonth = (year: number, monthIndex: number) => year * 12 + monthIndex;

/** Does this deal recognize a payment in (year, monthIndex), given it recurs every `interval` months starting at first service? */
function recognizesInMonth(
  firstServiceYear: number,
  firstServiceMonthIndex: number,
  interval: number,
  year: number,
  monthIndex: number
): boolean {
  const delta = absoluteMonth(year, monthIndex) - absoluteMonth(firstServiceYear, firstServiceMonthIndex);
  return delta >= 0 && delta % interval === 0;
}

/**
 * Revenue actually recognized in (year, monthIndex) from already-signed Sales
 * Tracker deals: each deal bills its Gross Ticket amount on first service and
 * every `interval` months after, forever — contracts auto-renew, so once ARR
 * is added it recurs in perpetuity rather than being a one-time bump.
 */
function signedAccountsRevenueForMonth(records: SalesRecord[], year: number, monthIndex: number): number {
  let total = 0;
  for (const r of records) {
    if (!r.firstServiceDate || r.grossTicket == null || !r.frequencyPerYear) continue;
    const [fy, fm] = r.firstServiceDate.split("-").map(Number);
    if (recognizesInMonth(fy, fm - 1, intervalMonths(r.frequencyPerYear), year, monthIndex)) {
      total += r.grossTicket;
    }
  }
  return total;
}

/** ARR-weighted average of a field over deals whose first-service date falls within [startYm, endYm] inclusive (YYYY-MM strings). */
function recentCohort(records: SalesRecord[], startYm: string, endYm: string) {
  return records.filter(
    (r) => r.firstServiceDate && r.firstServiceDate.slice(0, 7) >= startYm && r.firstServiceDate.slice(0, 7) <= endYm
  );
}

export function buildForecast(
  plAccrual: ReportData,
  plCash: ReportData,
  balanceSheet: ReportData,
  sales: SalesTrackerData
): ForecastResult {
  const actualPeriods = plAccrual.periods.filter((p) => p !== "Total");
  const income = plAccrual.summary["totalIncome"] ?? {};
  const cogs = plAccrual.summary["costOfGoodsSold"] ?? {};
  const grossProfitByPeriod = plAccrual.summary["grossProfit"] ?? {};
  const totalExpensesByPeriod = plAccrual.summary["totalExpenses"] ?? {};
  const netOtherIncomeByPeriod = plAccrual.summary["netOtherIncome"] ?? {};
  const netIncomeByPeriod = plAccrual.summary["netIncome"] ?? {};
  const cashNetIncomeByPeriod = plCash.summary["netIncome"] ?? {};

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
      grossProfit: grossProfitByPeriod[period] ?? 0,
      totalExpenses: totalExpensesByPeriod[period] ?? 0,
      otherIncomeNet: netOtherIncomeByPeriod[period] ?? 0,
      netIncome: netIncomeByPeriod[period] ?? 0,
      signedAccountsRevenue: 0,
      assumedNewBusinessRevenue: 0,
    };
  });

  const records = sales.records;

  // How much of each actual month's revenue the Sales Tracker's own deals explain,
  // vs. everything else (legacy pre-tracker accounts, product sales, etc.) — the
  // "untracked baseline" that should carry forward roughly flat into the forecast.
  const untrackedGaps = months.map((m) => m.revenue - signedAccountsRevenueForMonth(records, m.year, m.monthIndex));
  const untrackedBaseline =
    untrackedGaps.slice(-3).reduce((s, g) => s + g, 0) / Math.min(3, untrackedGaps.length);

  // Calibrate assumed future new-business velocity off the most recent 3 actual
  // months of signings (by first-service date) — this is where a rep ramping up
  // (or slowing down) shows up, rather than a full-year average burying it.
  const ymFromAbsolute = (abs: number) => {
    const year = Math.floor(abs / 12);
    const monthIndex = abs % 12;
    return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  };
  const cutoffAbs = absoluteMonth(cutoffYear, cutoffMonthIndex);
  const cohort = recentCohort(records, ymFromAbsolute(cutoffAbs - 2), ymFromAbsolute(cutoffAbs));
  const cohortArr = cohort.reduce((s, r) => s + (r.arr ?? 0), 0);
  const cohortGross = cohort.reduce((s, r) => s + (r.grossTicket ?? 0), 0);
  const cohortFreqWeighted = cohortArr
    ? cohort.reduce((s, r) => s + (r.frequencyPerYear ?? 4) * (r.arr ?? 0), 0) / cohortArr
    : 4;
  const firstMonthRatio = cohortArr ? cohortGross / cohortArr : 0.25;
  const monthlyNewArrPace = cohortArr / 3;
  const newBusinessInterval = intervalMonths(cohortFreqWeighted);
  const newBusinessCohortAmount = monthlyNewArrPace * firstMonthRatio;

  // Always generate at least 6 forecast months so the cash projection can reach
  // 6 months out even when the actuals cutoff is late in the calendar year.
  const horizonMonths = Math.max(11 - cutoffMonthIndex, 6);
  const newBusinessCohortStarts: { year: number; monthIndex: number }[] = [];

  for (let i = 1; i <= horizonMonths; i++) {
    const abs = cutoffAbs + i;
    const year = Math.floor(abs / 12);
    const monthIndex = abs % 12;
    newBusinessCohortStarts.push({ year, monthIndex });

    const signedRevenue = signedAccountsRevenueForMonth(records, year, monthIndex);
    const newBusinessRevenue = newBusinessCohortStarts.reduce(
      (sum, cohortStart) =>
        sum +
        (recognizesInMonth(cohortStart.year, cohortStart.monthIndex, newBusinessInterval, year, monthIndex)
          ? newBusinessCohortAmount
          : 0),
      0
    );

    const revenue = untrackedBaseline + signedRevenue + newBusinessRevenue;
    const cogsRatio = sumRatio(months, "costOfGoodsSold", "revenue");
    const costOfGoodsSold = revenue * cogsRatio;
    const grossProfit = revenue - costOfGoodsSold;
    const avgExpenses = average(months, "totalExpenses");
    const avgOtherIncomeNet = average(months, "otherIncomeNet");
    const netIncome = grossProfit - avgExpenses + avgOtherIncomeNet;

    months.push({
      period: `${MONTH_NAMES[monthIndex]} ${year}`,
      monthIndex,
      year,
      isActual: false,
      revenue,
      costOfGoodsSold,
      grossProfit,
      totalExpenses: avgExpenses,
      otherIncomeNet: avgOtherIncomeNet,
      netIncome,
      signedAccountsRevenue: signedRevenue,
      assumedNewBusinessRevenue: newBusinessRevenue,
    });
  }

  // "Full year" totals cover the actuals' calendar year only, even though a few
  // extra forecast months may have been generated beyond it to support the
  // 6-month cash projection.
  const fullYearMonths = months.filter((m) => m.year === cutoffYear);
  const sum = (key: keyof ForecastMonth) => fullYearMonths.reduce((s, m) => s + (m[key] as number), 0);

  const unscheduledPipelineArr = records
    .filter((r) => !r.firstServiceDate && r.signDate && r.arr != null)
    .reduce((s, r) => s + (r.arr ?? 0), 0);

  // Cash projection: start from the actual bank balance on the balance sheet, then
  // roll forward using cash-basis net income for the actual months already behind
  // us, and forecast accrual net income adjusted by the historical cash-vs-accrual
  // timing gap for months ahead. That gap is genuinely noisy month to month (AR/AP
  // timing, quarterly billings landing lumpily) so the band widens with sqrt(months)
  // rather than pretending a single precise number.
  const actualCashGaps = actualPeriods.map(
    (p) => (cashNetIncomeByPeriod[p] ?? 0) - (netIncomeByPeriod[p] ?? 0)
  );
  const avgCashGap = actualCashGaps.reduce((s, g) => s + g, 0) / (actualCashGaps.length || 1);
  const variance =
    actualCashGaps.reduce((s, g) => s + (g - avgCashGap) ** 2, 0) / (actualCashGaps.length || 1);
  const monthlyGapStdev = Math.sqrt(variance);

  const startingCash = balanceSheet.rows.find((r) => r.label === "Total for Bank Accounts")?.values["Total"] ?? 0;
  const forecastOnly = months.filter((m) => !m.isActual);
  const cashProjectionTargets = [1, 2, 3, 6];
  const cashProjection: CashProjectionPoint[] = cashProjectionTargets
    .filter((n) => n <= forecastOnly.length)
    .map((n) => {
      const cumulativeNetIncome = forecastOnly.slice(0, n).reduce((s, m) => s + m.netIncome, 0);
      const estimatedCash = startingCash + cumulativeNetIncome + avgCashGap * n;
      const band = monthlyGapStdev * Math.sqrt(n);
      return {
        monthsOut: n,
        period: forecastOnly[n - 1].period,
        estimatedCash,
        lowBand: estimatedCash - band,
        highBand: estimatedCash + band,
      };
    });

  return {
    months,
    fullYear: {
      revenue: sum("revenue"),
      costOfGoodsSold: sum("costOfGoodsSold"),
      grossProfit: sum("grossProfit"),
      totalExpenses: sum("totalExpenses"),
      netIncome: sum("netIncome"),
      signedAccountsRevenue: sum("signedAccountsRevenue"),
      assumedNewBusinessRevenue: sum("assumedNewBusinessRevenue"),
    },
    ytdActual: {
      revenue: months.filter((m) => m.isActual).reduce((s, m) => s + m.revenue, 0),
      netIncome: months.filter((m) => m.isActual).reduce((s, m) => s + m.netIncome, 0),
      lastActualPeriod: lastActualLabel,
    },
    unscheduledPipelineArr,
    cashProjection,
    methodologyNotes: [
      "Revenue is built bottom-up from the Sales Tracker: each signed deal bills its Gross Ticket amount on first service and every N months after (N implied by its billing frequency), forever — since HOODZ contracts auto-renew, ARR compounds rather than resetting each year.",
      `The Sales Tracker doesn't cover every account (it starts Sept 2024), so a residual "untracked" revenue base of ~${formatUsd(untrackedBaseline)}/mo — legacy accounts and one-off items not in the tracker — is carried forward flat from the trailing 3 actual months.`,
      `Future new business is assumed to continue at the pace of the trailing 3 months of signings (~${formatUsd(monthlyNewArrPace)}/mo of new ARR, recognized at ${(firstMonthRatio * 100).toFixed(0)}% in the signing month and recurring every ${newBusinessInterval} month(s) after) — this bakes in the recent acceleration in sales velocity rather than a flat full-year average, without assuming it keeps accelerating further.`,
      `Cost of Goods Sold is forecast at ${(sumRatio(months.filter((m) => m.isActual), "costOfGoodsSold", "revenue") * 100).toFixed(1)}% of revenue, the YTD aggregate ratio. Operating expenses are held flat at the YTD monthly average.`,
      `Cash projection starts from the actual bank balance on the balance sheet (${formatUsd(startingCash)}) and rolls forward net income, adjusted by the historical average cash-vs-accrual timing gap (${formatUsd(avgCashGap)}/mo). That gap swings by roughly ±${formatUsd(monthlyGapStdev)} month to month in the trailing 8 months (AR collections and quarterly billings land lumpily) — the low/high band reflects that, widening for further-out months.`,
      "This isn't a seasonality model — there's only 8 months of monthly history so far, not enough to fit a real seasonal curve. Revisit after a second year of data.",
    ],
  };
}

function average(months: ForecastMonth[], key: "totalExpenses" | "otherIncomeNet"): number {
  const actual = months.filter((m) => m.isActual);
  return actual.reduce((s, m) => s + m[key], 0) / (actual.length || 1);
}

function sumRatio(
  months: ForecastMonth[],
  numeratorKey: "costOfGoodsSold",
  denominatorKey: "revenue"
): number {
  const actual = months.filter((m) => m.isActual);
  const num = actual.reduce((s, m) => s + m[numeratorKey], 0);
  const den = actual.reduce((s, m) => s + m[denominatorKey], 0);
  return den ? num / den : 0;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
    value
  );
}
