import { NextRequest, NextResponse } from "next/server";
import { syncQboProfitAndLoss } from "@/lib/qbo/sync";

/**
 * Daily automatic refresh, triggered by Vercel Cron (see vercel.json). Not
 * behind the sign-in gate (proxy.ts excludes /api/cron) since a cron job
 * has no browser session — instead it's protected by CRON_SECRET, which
 * Vercel sends automatically as a bearer token for cron-triggered requests
 * once that env var is set.
 */
export async function GET(req: NextRequest) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await syncQboProfitAndLoss();
  return NextResponse.json(result, { status: result.ran ? 200 : 202 });
}
