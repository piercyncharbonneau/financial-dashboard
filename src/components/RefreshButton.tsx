"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RefreshButton() {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    setStatus(null);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const data = await res.json();
      if (data.ran) {
        setStatus("Refreshed");
        startTransition(() => router.refresh());
      } else {
        setStatus(data.reason ?? data.error ?? "Nothing to refresh yet");
      }
    } catch {
      setStatus("Refresh failed");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="text-xs text-black/50 dark:text-white/50 hover:underline text-left disabled:opacity-50"
      >
        {isPending ? "Refreshing…" : "Refresh data"}
      </button>
      {status && <p className="text-[11px] text-black/40 dark:text-white/40">{status}</p>}
    </div>
  );
}
