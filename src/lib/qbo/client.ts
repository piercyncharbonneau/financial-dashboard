import OAuthClient from "intuit-oauth";
import { readQboTokens, writeQboTokens, type QboTokens } from "./tokenStore";

export function isQboConfigured(): boolean {
  return Boolean(
    process.env.QBO_CLIENT_ID && process.env.QBO_CLIENT_SECRET && process.env.QBO_REDIRECT_URI
  );
}

function assertConfigured() {
  if (!isQboConfigured()) {
    throw new Error(
      "QuickBooks is not configured. Set QBO_CLIENT_ID, QBO_CLIENT_SECRET, and QBO_REDIRECT_URI."
    );
  }
}

function newClient(existing: QboTokens | null): OAuthClient {
  return new OAuthClient({
    clientId: process.env.QBO_CLIENT_ID!,
    clientSecret: process.env.QBO_CLIENT_SECRET!,
    environment: (process.env.QBO_ENVIRONMENT as "sandbox" | "production") ?? "sandbox",
    redirectUri: process.env.QBO_REDIRECT_URI!,
    token: existing
      ? {
          access_token: existing.accessToken,
          refresh_token: existing.refreshToken,
          realmId: existing.realmId,
        }
      : undefined,
  });
}

/** Client for the initial OAuth handshake (authorize + callback) — no stored token needed yet. */
export function getOAuthClient(): OAuthClient {
  assertConfigured();
  return newClient(null);
}

export async function persistTokenFromClient(client: OAuthClient, realmId: string) {
  const token = client.getToken();
  const tokens: QboTokens = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    realmId,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
  };
  await writeQboTokens(tokens);
  return tokens;
}

/** Client for authenticated API calls — loads the stored token and refreshes it first if expired. */
export async function getAuthenticatedClient(): Promise<{ client: OAuthClient; realmId: string }> {
  assertConfigured();
  const tokens = await readQboTokens();
  if (!tokens) throw new Error("QuickBooks is not connected yet. Visit /integrations to connect.");

  const client = newClient(tokens);
  const expiresSoon = tokens.expiresAt < Date.now() + 60_000;
  if (expiresSoon) {
    await client.refresh();
    await persistTokenFromClient(client, tokens.realmId);
  }
  return { client, realmId: tokens.realmId };
}

export async function getConnectionStatus(): Promise<{ connected: boolean; realmId?: string }> {
  const tokens = await readQboTokens();
  if (!tokens) return { connected: false };
  return { connected: true, realmId: tokens.realmId };
}
