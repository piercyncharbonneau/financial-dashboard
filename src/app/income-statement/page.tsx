import Link from "next/link";
import clsx from "clsx";
import { getLatestProfitAndLoss } from "@/lib/data/reports";
import { PLTable } from "@/components/PLTable";
import type { Basis, Granularity } from "@/lib/data/types";

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "px-3 py-1.5 rounded-lg text-sm font-medium",
        active
          ? "bg-foreground text-background"
          : "bg-black/[.04] dark:bg-white/[.06] text-black/60 dark:text-white/60 hover:bg-black/[.08] dark:hover:bg-white/[.1]"
      )}
    >
      {children}
    </Link>
  );
}

export default async function IncomeStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ granularity?: string; basis?: string }>;
}) {
  const params = await searchParams;
  const granularity: Exclude<Granularity, null> =
    params.granularity === "weekly" ? "weekly" : "monthly";
  const basis: Basis = params.basis === "cash" ? "cash" : "accrual";

  const report = await getLatestProfitAndLoss(granularity, basis);

  const mkHref = (g: string, b: string) => `/income-statement?granularity=${g}&basis=${b}`;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Income Statement</h1>
        <p className="text-sm text-black/50 dark:text-white/50">{report.periodLabel}</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-2">
          <Tab href={mkHref("monthly", basis)} active={granularity === "monthly"}>
            Monthly
          </Tab>
          <Tab href={mkHref("weekly", basis)} active={granularity === "weekly"}>
            Weekly
          </Tab>
        </div>
        <div className="flex gap-2">
          <Tab href={mkHref(granularity, "accrual")} active={basis === "accrual"}>
            Accrual
          </Tab>
          <Tab href={mkHref(granularity, "cash")} active={basis === "cash"}>
            Cash
          </Tab>
        </div>
      </div>

      <PLTable report={report} />
    </div>
  );
}
