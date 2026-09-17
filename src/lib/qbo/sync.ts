import { fetchProfitAndLossTrailingMonths } from "./reports";
import { isQboConfigured } from "./client";
import { kvGet, kvSet } from "@/lib/kv";
import { qboCacheKey } from "@/lib/data/reports";

const LAST_SYNC_KEY = "qbo:lastSyncedAt";

export interface SyncResult {
  ran: boolean;
  reason?: string;
  syncedAt?: string;
  error?: string;
}

/** Pulls trailing 24 months of P&L (accrual + cash) from QuickBooks and caches it in KV. */
export async function syncQboProfitAndLoss(): Promise<SyncResult> {
  if (!isQboConfigured()) {
    return { ran: false, reason: "QuickBooks is not configured (missing QBO_* env vars)." };
  }

  try {
    const [accrual, cash] = await Promise.all([
      fetchProfitAndLossTrailingMonths(24, "accrual"),
      fetchProfitAndLossTrailingMonths(24, "cash"),
    ]);
    await kvSet(qboCacheKey("monthly", "accrual"), accrual);
    await kvSet(qboCacheKey("monthly", "cash"), cash);
    const syncedAt = new Date().toISOString();
    await kvSet(LAST_SYNC_KEY, syncedAt);
    return { ran: true, syncedAt };
  } catch (err) {
    return { ran: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function getLastSyncedAt(): Promise<string | null> {
  return kvGet<string>(LAST_SYNC_KEY);
}
