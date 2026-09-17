import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient, persistTokenFromClient } from "@/lib/qbo/client";

export async function GET(req: NextRequest) {
  const client = getOAuthClient();

  try {
    await client.createToken(req.url);
    const realmId = new URL(req.url).searchParams.get("realmId") ?? "";
    await persistTokenFromClient(client, realmId);
    return NextResponse.redirect(new URL("/integrations?qbo=connected", req.url));
  } catch (err) {
    console.error("QuickBooks OAuth callback failed", err);
    return NextResponse.redirect(new URL("/integrations?error=qbo_callback_failed", req.url));
  }
}
