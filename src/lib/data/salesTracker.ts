import fs from "fs";
import path from "path";

export interface SalesRecord {
  value: number | null;
  payStatus: string | null;
  account: string;
  category: string | null;
  origination: string | null;
  sourcedBy: string | null;
  closedBy: string | null;
  signDate: string | null; // ISO date
  firstServiceDate: string | null;
  payrollDate: string | null;
  grossTicket: number | null;
  frequencyPerYear: number | null;
  arr: number | null;
  commissions: Record<string, number>;
}

export interface SalesTrackerData {
  source: string;
  sourceFileId: string;
  importedAt: string;
  recordCount: number;
  records: SalesRecord[];
}

export function getSalesTracker(): SalesTrackerData {
  const filePath = path.join(process.cwd(), "data", "seed", "sales-tracker.json");
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}
