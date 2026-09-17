import fs from "fs";
import path from "path";

/**
 * Minimal key-value store abstraction. Falls back to a local JSON file when
 * Upstash env vars aren't set (local dev). On Vercel, serverless functions
 * have a read-only filesystem outside /tmp and no shared disk between
 * invocations — the file fallback silently does nothing useful in that
 * environment. Add the "Upstash for Redis" integration from the Vercel
 * Storage tab (one click; it sets UPSTASH_REDIS_REST_URL/TOKEN
 * automatically) before relying on daily auto-refresh or QuickBooks token
 * persistence in production.
 */

const hasUpstash = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const LOCAL_STORE_DIR = path.join(process.cwd(), ".local", "kv");

async function upstashRequest(command: unknown[]): Promise<unknown> {
  const res = await fetch(process.env.UPSTASH_REDIS_REST_URL!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Upstash request failed: ${res.status}`);
  const json = await res.json();
  return json.result;
}

function localPath(key: string): string {
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(LOCAL_STORE_DIR, `${safe}.json`);
}

export async function kvGet<T>(key: string): Promise<T | null> {
  if (hasUpstash) {
    const result = await upstashRequest(["GET", key]);
    return result ? (JSON.parse(result as string) as T) : null;
  }
  try {
    return JSON.parse(fs.readFileSync(localPath(key), "utf-8")) as T;
  } catch {
    return null;
  }
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  const serialized = JSON.stringify(value);
  if (hasUpstash) {
    await upstashRequest(["SET", key, serialized]);
    return;
  }
  fs.mkdirSync(LOCAL_STORE_DIR, { recursive: true });
  fs.writeFileSync(localPath(key), serialized);
}

export function kvIsPersistent(): boolean {
  return hasUpstash;
}
