import { getConnectionStatus, isQboConfigured } from "@/lib/qbo/client";
import clsx from "clsx";

function StatusBadge({ status }: { status: "connected" | "not_configured" | "planned" }) {
  const label = {
    connected: "Connected",
    not_configured: "Not connected",
    planned: "Planned",
  }[status];
  return (
    <span
      className={clsx("text-xs font-medium px-2 py-0.5 rounded-full", {
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400": status === "connected",
        "bg-amber-500/10 text-amber-600 dark:text-amber-400": status === "not_configured",
        "bg-black/[.06] dark:bg-white/[.08] text-black/50 dark:text-white/50": status === "planned",
      })}
    >
      {label}
    </span>
  );
}

function IntegrationCard({
  title,
  description,
  status,
  needFromUser,
  children,
}: {
  title: string;
  description: string;
  status: "connected" | "not_configured" | "planned";
  needFromUser: string[];
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-sm text-black/50 dark:text-white/50">{description}</p>
        </div>
        <StatusBadge status={status} />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-black/40 dark:text-white/40 mb-1">
          Needed from you
        </p>
        <ul className="text-sm text-black/60 dark:text-white/60 list-disc list-inside space-y-0.5">
          {needFromUser.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
      {children}
    </div>
  );
}

export default async function IntegrationsPage() {
  const qboStatus = await getConnectionStatus();
  const qboConfigured = isQboConfigured();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Integrations</h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          Connection status and setup requirements for each data source.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <IntegrationCard
          title="QuickBooks Online"
          description="Live financial data: P&L, balance sheet, cash flow. Currently seeded from manual monthly exports."
          status={qboStatus.connected ? "connected" : "not_configured"}
          needFromUser={[
            "Intuit Developer app created (done) — but the credentials on file are Development/Sandbox keys, which only connect to a fake test company, not your real books",
            "Get Production keys for the same app (the developer.intuit.com app page has a Production tab alongside Development) and set QBO_ENVIRONMENT=production with those keys",
            "Deploy to Vercel first — the Connect button below has to run from the live site so Intuit can redirect back to a real HTTPS URL",
            "Add the Upstash Redis integration in Vercel (Storage tab, one click) so the connection survives between requests — serverless functions don't share a local disk",
          ]}
        >
          {qboConfigured ? (
            <a
              href="/api/integrations/quickbooks/connect"
              className="self-start rounded-lg bg-foreground text-background text-sm font-medium px-3 py-1.5 hover:opacity-90"
            >
              {qboStatus.connected ? "Reconnect" : "Connect QuickBooks"}
            </a>
          ) : (
            <p className="text-xs text-black/40 dark:text-white/40">
              Set the QBO_* environment variables to enable the connect flow. See README.md.
            </p>
          )}
        </IntegrationCard>

        <IntegrationCard
          title="ServiceBridge (GPSI)"
          description="Dispatch and job data: jobs completed, technician utilization, scheduling, revenue-per-job."
          status="planned"
          needFromUser={[
            "Confirm whether ServiceBridge exposes a REST/API integration on your plan (check with GPSI support or your account rep)",
            "API credentials or an API key, plus any account/company identifiers",
            "Which fields matter most: job status, technician, revenue, service type, completion time",
          ]}
        />

        <IntegrationCard
          title="ADP"
          description="Payroll and labor cost data to connect revenue to labor cost as % of sales."
          status="planned"
          needFromUser={[
            "Confirm your ADP product (Workforce Now, RUN, etc.) — API access usually requires an ADP Marketplace partner agreement, which can take weeks to approve",
            "ADP Marketplace developer account + registered app credentials once approved",
            "In the meantime: a recurring manual payroll summary export works as a stopgap, same pattern as the QuickBooks exports",
          ]}
        />

        <IntegrationCard
          title="Slack"
          description="Push KPI alerts and weekly summaries to a channel; potentially trigger from dashboard thresholds."
          status="planned"
          needFromUser={[
            "Which channel(s) should receive alerts",
            "Permission to create a Slack app / bot token for your workspace (Slack admin approval)",
            "What should trigger a message (e.g. weekly summary, cash below threshold, negative net income month)",
          ]}
        />

        <IntegrationCard
          title="Sales Team Performance Tracker"
          description="Commission tracker: signed accounts, ARR added, closer/rep commissions. Snapshotted from the Google Sheet — see the Sales page."
          status="connected"
          needFromUser={[
            "Nothing to unblock this one — it's imported and live on the Sales page",
            "For a real-time connection instead of periodic snapshots: share the sheet with a Google service account (see README)",
            "Say the word whenever you want it refreshed, or ask me to re-pull it",
          ]}
        />

        <IntegrationCard
          title="Hoodz Master Schedule"
          description="Per-truck daily job schedule. Free-form calendar layout, not a clean table — deprioritized in favor of ServiceBridge if it has an API."
          status="planned"
          needFromUser={[
            "Confirm whether you still want this parsed by hand, or would rather wait for ServiceBridge",
            "If parsing by hand: which fields matter (job, truck, time, completion status) so I can define a schema for the free-form layout",
          ]}
        />

        <IntegrationCard
          title="Inventory & Fleet Tracking"
          description="Truck maintenance/repair log and per-vehicle cost totals (mileage, service due dates, maintenance/repair/purchase cost)."
          status="planned"
          needFromUser={[
            "Confirm you want this one built next (it's reasonably tabular, similar effort to the sales tracker)",
            "For a live connection: share the sheet with a Google service account (see README)",
          ]}
        />
      </div>
    </div>
  );
}
