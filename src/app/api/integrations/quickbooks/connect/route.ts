import { NextResponse } from "next/server";
import OAuthClient from "intuit-oauth";
import { getOAuthClient, isQboConfigured } from "@/lib/qbo/client";

export async function GET() {
  if (!isQboConfigured()) {
    return NextResponse.redirect(
      new URL(
        "/integrations?error=qbo_not_configured",
        process.env.QBO_REDIRECT_URI ?? "http://localhost:3000"
      )
    );
  }

  const client = getOAuthClient();
  const authUri = client.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: crypto.randomUUID(),
  });

  return NextResponse.redirect(authUri);
}
