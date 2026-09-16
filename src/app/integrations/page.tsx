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

export default function IntegrationsPage() {
  const qboStatus = getConnectionStatus();
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
            "Create an app at developer.intuit.com (Accounting scope)",
            "Set QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI, QBO_ENVIRONMENT env vars",
            "Click Connect below and authorize against your company file",
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
          title="Google Docs / Sheets"
          description="Pull in sales tracker, scheduling, and expense sheets your team already maintains."
          status="planned"
          needFromUser={[
            "Share (view access is enough) the specific Sheets/Docs to pull from",
            "A Google Cloud service account with access, or OAuth consent for a shared Google Workspace account",
            "Which columns/fields are the source of truth so we map them correctly",
          ]}
        />
      </div>
    </div>
  );
}
