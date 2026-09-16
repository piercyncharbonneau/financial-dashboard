import clsx from "clsx";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: string | null;
  deltaTone?: "positive" | "negative" | "neutral";
  subtext?: string;
}

export function KpiCard({ label, value, delta, deltaTone = "neutral", subtext }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-white/5 p-4 flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
        {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      <div className="flex items-center gap-2 min-h-[1.25rem]">
        {delta && (
          <span
            className={clsx("text-xs font-medium", {
              "text-emerald-600 dark:text-emerald-400": deltaTone === "positive",
              "text-red-600 dark:text-red-400": deltaTone === "negative",
              "text-black/40 dark:text-white/40": deltaTone === "neutral",
            })}
          >
            {delta}
          </span>
        )}
        {subtext && (
          <span className="text-xs text-black/40 dark:text-white/40">{subtext}</span>
        )}
      </div>
    </div>
  );
}
