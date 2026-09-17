import { NextResponse } from "next/server";
import { syncQboProfitAndLoss } from "@/lib/qbo/sync";

/** Manual "Refresh" button — behind the normal sign-in gate (not excluded in proxy.ts). */
export async function POST() {
  const result = await syncQboProfitAndLoss();
  return NextResponse.json(result, { status: result.ran ? 200 : 202 });
}
