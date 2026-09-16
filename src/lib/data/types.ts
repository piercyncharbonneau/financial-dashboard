export type Basis = "accrual" | "cash";
export type Granularity = "monthly" | "weekly" | null;
export type ReportType = "profit-and-loss" | "balance-sheet";

export interface ReportRow {
  label: string;
  displayName: string;
  accountCode: string | null;
  depth: number;
  isSubtotal: boolean;
  section: string | null;
  values: Record<string, number | null>;
}

export interface ReportData {
  company: string;
  reportName: string;
  periodLabel: string;
  basis: Basis | "unknown";
  periods: string[];
  rows: ReportRow[];
  summary: Record<string, Record<string, number | null>>;
  sourceFile: string;
  importedAt: string;
}

export interface ManifestEntry {
  id: string;
  reportType: ReportType;
  granularity: Granularity;
  basis: Basis;
  period: string;
  file: string;
}
