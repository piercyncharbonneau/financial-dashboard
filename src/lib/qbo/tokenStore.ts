import { kvGet, kvSet } from "@/lib/kv";

/**
 * QuickBooks OAuth token storage. Backed by the kv abstraction (see
 * src/lib/kv.ts) — a local file in dev, Upstash Redis in production once
 * that integration is added in Vercel. Without persistent storage in
 * production, tokens written by one serverless invocation won't be visible
 * to the next, and the daily refresh cron / "Connect QuickBooks" flow will
 * appear to work once and then silently lose the connection.
 */

const KEY = "qbo:tokens";

export interface QboTokens {
  accessToken: string;
  refreshToken: string;
  realmId: string;
  expiresAt: number; // epoch ms
}

export async function readQboTokens(): Promise<QboTokens | null> {
  return kvGet<QboTokens>(KEY);
}

export async function writeQboTokens(tokens: QboTokens): Promise<void> {
  await kvSet(KEY, tokens);
}
