import fs from "fs";
import path from "path";

/**
 * Minimal file-based token store for the QuickBooks OAuth tokens, used to
 * get the integration running locally. Tokens are written to a gitignored
 * path outside the repo's version-controlled data/. Before rolling this
 * out to more than one operator, replace this with tokens stored in a real
 * secrets manager or an encrypted database row, since this file is
 * plaintext on disk.
 */

const STORE_PATH = path.join(process.cwd(), ".local", "qbo-tokens.json");

export interface QboTokens {
  accessToken: string;
  refreshToken: string;
  realmId: string;
  expiresAt: number; // epoch ms
}

export function readQboTokens(): QboTokens | null {
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeQboTokens(tokens: QboTokens): void {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(tokens, null, 2));
}

export function clearQboTokens(): void {
  try {
    fs.unlinkSync(STORE_PATH);
  } catch {
    // nothing to clear
  }
}
