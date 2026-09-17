import { getAuthenticatedClient } from "./client";
import type { ReportData, ReportRow } from "../data/types";

/**
 * Pulls a Profit & Loss report from the QuickBooks Online Reports API,
 * summarized by month, and reshapes it into the same ReportData structure
 * scripts/import_qbo_export.py produces from an Excel export — so
 * src/lib/data/reports.ts, metrics.ts, and forecast.ts all work unchanged
 * regardless of whether the data came from a manual xlsx import or a live
 * API pull.
 *
 * NOTE: written against QuickBooks Online's documented Report API response
 * shape (nested Rows, each with an optional Header/Summary and a `group`
 * field like "Income" / "COGS" / "Expense" / "OtherIncome" / "OtherExpense"
 * / "NetIncome"). This has not been exercised against a live response yet —
 * the sandbox this was built in has no network access to Intuit's API.
 * Treat the first real sync as a validation pass: compare a month it
 * produces against the same month in QuickBooks Online directly.
 */

interface QboColData {
  value?: string;
  id?: string;
}

interface QboRow {
  type?: string;
  group?: string;
  Header?: { ColData: QboColData[] };
  Rows?: { Row: QboRow[] };
  Summary?: { ColData: QboColData[] };
  ColData?: QboColData[];
}

interface QboReportResponse {
  Header: { StartPeriod: string; EndPeriod: string };
  Columns: { Column: { ColTitle: string; ColType: string }[] };
  Rows: { Row: QboRow[] };
}

const GROUP_TO_SUMMARY_KEY: Record<string, string> = {
  Income: "totalIncome",
  COGS: "costOfGoodsSold",
  GrossProfit: "grossProfit",
  Expense: "totalExpenses",
  NetOperatingIncome: "netOperatingIncome",
  OtherIncome: "otherIncome",
  OtherExpense: "otherExpenses",
  NetOtherIncome: "netOtherIncome",
  NetIncome: "netIncome",
};

function parseMoney(value: string | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function walkRows(
  rows: QboRow[],
  periods: string[],
  section: string | null,
  depth: number,
  out: ReportRow[],
  summary: Record<string, Record<string, number | null>>
) {
  for (const row of rows) {
    const currentSection = row.group && !row.Rows ? section : row.group ?? section;

    if (row.Header) {
      const label = row.Header.ColData[0]?.value ?? "";
      walkRows(row.Rows?.Row ?? [], periods, row.group ?? currentSection, depth + 1, out, summary);
      if (row.Summary) {
        const values: Record<string, number | null> = {};
        periods.forEach((p, i) => (values[p] = parseMoney(row.Summary!.ColData[i + 1]?.value)));
        const summaryKey = row.group ? GROUP_TO_SUMMARY_KEY[row.group] : undefined;
        if (summaryKey) {
          summary[summaryKey] = values;
        } else {
          out.push({
            label: `Total for ${label}`,
            displayName: label,
            accountCode: null,
            depth,
            isSubtotal: true,
            section: row.group ?? currentSection,
            values,
          });
        }
      }
      continue;
    }

    if (row.ColData) {
      const label = row.ColData[0]?.value ?? "";
      const values: Record<string, number | null> = {};
      periods.forEach((p, i) => (values[p] = parseMoney(row.ColData![i + 1]?.value)));

      const summaryKey = row.group ? GROUP_TO_SUMMARY_KEY[row.group] : undefined;
      if (summaryKey) {
        summary[summaryKey] = values;
        continue;
      }

      const accountMatch = label.match(/^(\d{3,5}(?:\.\d+)?)\s+(.*)$/);
      out.push({
        label,
        displayName: accountMatch ? accountMatch[2] : label,
        accountCode: accountMatch ? accountMatch[1] : null,
        depth,
        isSubtotal: false,
        section: currentSection,
        values,
      });
    }
  }
}

export function parseQboReportResponse(report: QboReportResponse, basis: "accrual" | "cash"): ReportData {
  const periods = report.Columns.Column.slice(1).map((c) => c.ColTitle);
  const rows: ReportRow[] = [];
  const summary: Record<string, Record<string, number | null>> = {};

  walkRows(report.Rows.Row, periods, null, 0, rows, summary);

  return {
    company: "",
    reportName: "Profit and Loss",
    periodLabel: `${report.Header.StartPeriod} to ${report.Header.EndPeriod}`,
    basis,
    periods,
    rows,
    summary,
    sourceFile: "quickbooks-online-api",
    importedAt: new Date().toISOString(),
  };
}

/** Trailing N months of monthly Profit & Loss, live from QuickBooks Online. */
export async function fetchProfitAndLossTrailingMonths(
  months = 24,
  basis: "accrual" | "cash" = "accrual"
): Promise<ReportData> {
  const { client, realmId } = await getAuthenticatedClient();

  const end = new Date();
  const start = new Date(end.getFullYear(), end.getMonth() - (months - 1), 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const baseUrl = client.getQBOEnvironmentURI();
  const url =
    `${baseUrl}v3/company/${realmId}/reports/ProfitAndLoss` +
    `?start_date=${fmt(start)}&end_date=${fmt(end)}` +
    `&summarize_column_by=Month&accounting_method=${basis === "cash" ? "Cash" : "Accrual"}`;

  const response = await client.makeApiCall({ url, method: "GET" });
  return parseQboReportResponse(response.json as QboReportResponse, basis);
}
