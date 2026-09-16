import OAuthClient from "intuit-oauth";
import { readQboTokens, writeQboTokens, type QboTokens } from "./tokenStore";

export function isQboConfigured(): boolean {
  return Boolean(
    process.env.QBO_CLIENT_ID && process.env.QBO_CLIENT_SECRET && process.env.QBO_REDIRECT_URI
  );
}

export function getOAuthClient(): OAuthClient {
  if (!isQboConfigured()) {
    throw new Error(
      "QuickBooks is not configured. Set QBO_CLIENT_ID, QBO_CLIENT_SECRET, and QBO_REDIRECT_URI."
    );
  }
  const existing = readQboTokens();
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

export function persistTokenFromClient(client: OAuthClient, realmId: string) {
  const token = client.getToken();
  const tokens: QboTokens = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    realmId,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
  };
  writeQboTokens(tokens);
  return tokens;
}

export function getConnectionStatus(): { connected: boolean; realmId?: string } {
  const tokens = readQboTokens();
  if (!tokens) return { connected: false };
  return { connected: true, realmId: tokens.realmId };
}
